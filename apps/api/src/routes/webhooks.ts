import { Router } from "express";
import { OrderStatus, type Prisma } from "@prisma/client";
import { asBytes } from "../lib/bytes.js";
import { prisma } from "../lib/prisma.js";

export const webhooksRouter = Router();

type TranscriptTurn = {
  role?: unknown;
  message?: unknown;
  text?: unknown;
  time_in_call_secs?: unknown;
  tool_calls?: unknown;
  tool_results?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Place-Order returns `order_id` inside the post-call transcript tool result.
 * ElevenLabs does not put the conversation id on that tool request unless the
 * tool body includes the system__conversation_id dynamic variable.
 */
function collectOrderRefs(value: unknown, externalIds: Set<string>, dbIds: Set<string>, depth = 0) {
  if (depth > 24 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const looksLikeJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"));
    if (!looksLikeJson) return;
    try {
      collectOrderRefs(JSON.parse(trimmed), externalIds, dbIds, depth + 1);
    } catch {
      // Tool payloads sometimes contain truncated JSON.
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectOrderRefs(item, externalIds, dbIds, depth + 1);
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const externalId = asString(record.order_id) ?? asString(record.orderId);
  const dbId = asString(record.order_db_id) ?? asString(record.orderDbId);
  if (externalId && /^O-\d+$/.test(externalId)) externalIds.add(externalId);
  if (dbId && /^c[a-z0-9]{20,}$/.test(dbId)) dbIds.add(dbId);
  for (const nested of Object.values(record)) {
    collectOrderRefs(nested, externalIds, dbIds, depth + 1);
  }
}

async function linkOrdersFromTranscript(conversationDbId: string, transcript: unknown, tableLabel?: string) {
  const externalIds = new Set<string>();
  const dbIds = new Set<string>();
  collectOrderRefs(transcript, externalIds, dbIds);
  if (!externalIds.size && !dbIds.size) return;

  const result = await prisma.order.updateMany({
    where: {
      conversationId: null,
      OR: [
        ...(externalIds.size ? [{ externalId: { in: [...externalIds] } }] : []),
        ...(dbIds.size ? [{ id: { in: [...dbIds] } }] : []),
      ],
    },
    data: { conversationId: conversationDbId },
  });
  if (result.count) {
    console.log(`Linked ${result.count} order(s) to conversation ${conversationDbId}`);
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationDbId },
    select: { language: true },
  });
  if (conversation?.language) {
    await prisma.order.updateMany({
      where: {
        conversationId: conversationDbId,
        OR: [{ language: null }, { language: "" }],
      },
      data: { language: conversation.language },
    });
  }

  if (tableLabel) return;
  const linked = await prisma.order.findFirst({
    where: { conversationId: conversationDbId, tableLabel: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { tableLabel: true },
  });
  if (!linked?.tableLabel) return;
  await prisma.conversation.update({
    where: { id: conversationDbId },
    data: { tableLabel: linked.tableLabel },
  });
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function collectionValue(
  results: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  if (!results) return undefined;
  const entry = results[key];
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    return (
      asString((entry as { value?: unknown }).value) ??
      asString((entry as { result?: unknown }).result)
    );
  }
  return undefined;
}

/** Flatten transcript for dashboard text view; keep tool turns as JSON lines. */
function transcriptToText(transcript: unknown): string | undefined {
  if (typeof transcript === "string") return transcript;
  if (!Array.isArray(transcript)) return undefined;

  const lines = transcript
    .map((turn) => {
      if (!turn || typeof turn !== "object") return null;
      const t = turn as TranscriptTurn;
      const role = asString(t.role) ?? "unknown";
      const message = asString(t.message) ?? asString(t.text);

      if (message) return `${role}: ${message}`;

      if (Array.isArray(t.tool_calls) && t.tool_calls.length) {
        return `${role}: [tool_calls] ${JSON.stringify(t.tool_calls)}`;
      }
      if (Array.isArray(t.tool_results) && t.tool_results.length) {
        return `${role}: [tool_results] ${JSON.stringify(t.tool_results)}`;
      }
      return null;
    })
    .filter(Boolean) as string[];

  return lines.length ? lines.join("\n") : undefined;
}

function extractOrderItems(source: Record<string, unknown> | undefined) {
  const raw = source?.order_items ?? source?.items;
  if (!Array.isArray(raw)) return null;

  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const name = asString((item as { name?: unknown }).name);
      if (!name) return null;
      const quantity = Number((item as { quantity?: unknown }).quantity ?? 1);
      const priceCents = Number(
        (item as { price_cents?: unknown }).price_cents ??
          (item as { priceCents?: unknown }).priceCents ??
          0
      );
      return {
        name,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        priceCents: Number.isFinite(priceCents) && priceCents >= 0 ? priceCents : 0,
      };
    })
    .filter(Boolean) as Array<{ name: string; quantity: number; priceCents: number }>;

  return items.length ? items : null;
}

function phoneFromMetadata(meta: Record<string, unknown>): string | undefined {
  const phoneCall = meta.phone_call;
  if (phoneCall && typeof phoneCall === "object") {
    return (
      asString((phoneCall as { external_number?: unknown }).external_number) ??
      asString((phoneCall as { agent_number?: unknown }).agent_number)
    );
  }
  return asString(meta.caller_phone);
}

/**
 * ElevenLabs `post_call_audio`: base64 MP3 in data.full_audio.
 * Stored separately so list/detail queries do not load the file.
 */
async function ingestElevenLabsAudio(
  body: { data?: Record<string, unknown> },
  res: import("express").Response
) {
  const data = (body.data ?? {}) as Record<string, unknown>;
  const agentId = asString(data.agent_id);
  const conversationId = asString(data.conversation_id);
  const fullAudio = asString(data.full_audio);

  if (!conversationId || !fullAudio) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let audio: Buffer;
  try {
    audio = Buffer.from(fullAudio, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid audio" });
  }
  if (!audio.length) {
    return res.status(400).json({ error: "Invalid audio" });
  }

  const conversation = await prisma.conversation.upsert({
    where: { externalId: conversationId },
    create: {
      externalId: conversationId,
      agentId,
      status: "completed",
    },
    update: {
      agentId: agentId ?? undefined,
    },
  });

  await prisma.conversationAudio.upsert({
    where: { conversationId: conversation.id },
    create: {
      conversationId: conversation.id,
      contentType: "audio/mpeg",
      data: asBytes(audio),
    },
    update: {
      contentType: "audio/mpeg",
      data: asBytes(audio),
    },
  });

  console.log(`Stored conversation audio ${conversation.id} (${audio.length} bytes)`);

  return res.status(200).json({
    success: true,
    chatId: conversation.id,
  });
}

/**
 * POST webhook body handler — post_call_transcription and post_call_audio.
 * Mapped into Conversation (our "chat") model.
 */
async function ingestElevenLabsWebhook(
  req: import("express").Request,
  res: import("express").Response
) {
  const body = (req.body ?? {}) as {
    type?: string;
    event_timestamp?: number;
    data?: Record<string, unknown>;
  };

  if (body.type === "post_call_audio") {
    return ingestElevenLabsAudio(body, res);
  }

  if (body.type !== "post_call_transcription") {
    return res.status(200).json({
      success: true,
      message: "Event type ignored",
    });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const agentId = asString(data.agent_id);
  const conversationId = asString(data.conversation_id);

  if (!agentId || !conversationId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const meta = ((data.metadata ?? {}) as Record<string, unknown>) ?? {};
  const analysis = ((data.analysis ?? {}) as Record<string, unknown>) ?? {};
  const collection = (analysis.data_collection_results ?? {}) as Record<string, unknown>;
  const clientData = (data.conversation_initiation_client_data ?? {}) as Record<string, unknown>;
  const dynamicVars = (clientData.dynamic_variables ?? {}) as Record<string, unknown>;

  const summaryFull = asString(analysis.transcript_summary);
  const summary =
    summaryFull && summaryFull.length > 500 ? summaryFull.slice(0, 500) : summaryFull;

  const transcriptText = transcriptToText(data.transcript);
  const startedAtUnix = asNumber(meta.start_time_unix_secs);
  const durationSeconds = asNumber(meta.call_duration_secs);
  const startedAt =
    typeof startedAtUnix === "number" ? new Date(startedAtUnix * 1000) : undefined;
  const endedAt =
    startedAt && durationSeconds !== undefined
      ? new Date(startedAt.getTime() + durationSeconds * 1000)
      : undefined;

  const tableLabel =
    collectionValue(collection, "table") ??
    collectionValue(collection, "table_label") ??
    asString(dynamicVars.table) ??
    asString(meta.table_label) ??
    asString(meta.table);

  const language =
    asString(meta.main_language) ??
    collectionValue(collection, "language") ??
    asString(dynamicVars.language) ??
    asString(meta.language);

  const callerPhone =
    phoneFromMetadata(meta) ??
    collectionValue(collection, "customer_phone");

  const callerName =
    collectionValue(collection, "customer_name") ??
    asString(meta.caller_name) ??
    tableLabel;

  // Structured turns for dashboard / future message UI
  const transcriptTurns = Array.isArray(data.transcript)
    ? data.transcript.map((turn) => {
        if (!turn || typeof turn !== "object") return turn;
        const t = turn as TranscriptTurn;
        const offset = asNumber(t.time_in_call_secs);
        const at =
          startedAt && offset !== undefined
            ? new Date(startedAt.getTime() + offset * 1000).toISOString()
            : null;
        return {
          role: asString(t.role) ?? "unknown",
          direction: asString(t.role) === "user" ? "in" : "out",
          message: asString(t.message) ?? asString(t.text) ?? null,
          time_in_call_secs: offset ?? null,
          at,
          tool_calls: t.tool_calls ?? null,
          tool_results: t.tool_results ?? null,
        };
      })
    : null;

  const metadata = {
    eventType: body.type,
    eventTimestamp: body.event_timestamp ?? null,
    notes: summaryFull ?? null,
    callSuccessful: asString(analysis.call_successful) ?? null,
    terminationReason: asString(meta.termination_reason) ?? null,
    phoneCall: (meta.phone_call ?? null) as Prisma.InputJsonValue | null,
    dynamicVariables: (dynamicVars ?? null) as Prisma.InputJsonValue | null,
    dataCollection: (analysis.data_collection_results ?? null) as Prisma.InputJsonValue | null,
    transcriptTurns: (transcriptTurns ?? null) as Prisma.InputJsonValue | null,
    rawMetadata: (data.metadata ?? null) as Prisma.InputJsonValue | null,
  } satisfies Prisma.InputJsonObject;

  const conversation = await prisma.conversation.upsert({
    where: { externalId: conversationId },
    create: {
      externalId: conversationId,
      agentId,
      callerName,
      callerPhone,
      tableLabel,
      language,
      summary: summary ?? summaryFull,
      transcript: transcriptText,
      status: "resolved",
      durationSeconds,
      startedAt,
      endedAt,
      metadata: metadata as Prisma.InputJsonValue,
    },
    update: {
      agentId,
      callerName: callerName ?? undefined,
      callerPhone: callerPhone ?? undefined,
      tableLabel: tableLabel ?? undefined,
      language: language ?? undefined,
      summary: summary ?? summaryFull ?? undefined,
      transcript: transcriptText ?? undefined,
      status: "resolved",
      durationSeconds,
      startedAt,
      endedAt,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  await linkOrdersFromTranscript(conversation.id, data.transcript, conversation.tableLabel ?? undefined);

  // Optional order items from analysis/collection (Place-Order tool is primary path)
  const orderItems =
    extractOrderItems(meta) ??
    extractOrderItems(collection) ??
    extractOrderItems(analysis);

  if (orderItems) {
    const totalCents = orderItems.reduce(
      (sum, item) => sum + item.quantity * item.priceCents,
      0
    );
    const orderExternalId =
      collectionValue(collection, "order_id") ??
      asString(meta.order_id) ??
      `conv-${conversationId}`;
    const itemsJson = orderItems as unknown as Prisma.InputJsonValue;

    await prisma.order.upsert({
      where: { externalId: orderExternalId },
      create: {
        conversationId: conversation.id,
        externalId: orderExternalId,
        customerName: conversation.callerName,
        customerPhone: conversation.callerPhone,
        tableLabel: conversation.tableLabel,
        language: conversation.language,
        items: itemsJson,
        notes:
          collectionValue(collection, "notes") ?? asString(meta.notes) ?? undefined,
        totalCents,
        status: OrderStatus.PENDING,
      },
      update: {
        conversationId: conversation.id,
        customerName: conversation.callerName,
        customerPhone: conversation.callerPhone,
        tableLabel: conversation.tableLabel,
        language: conversation.language,
        items: itemsJson,
        notes:
          collectionValue(collection, "notes") ?? asString(meta.notes) ?? undefined,
        totalCents,
      },
    });
  }

  return res.status(200).json({
    success: true,
    chatId: conversation.id,
  });
}

// Public post-call webhook. No shared secret or HMAC check.
webhooksRouter.post("/elevenlabs/webhook", ingestElevenLabsWebhook);
webhooksRouter.post("/elevenlabs", ingestElevenLabsWebhook);
webhooksRouter.post("/conversations", ingestElevenLabsWebhook);
webhooksRouter.post("/elevenlabs/conversations", ingestElevenLabsWebhook);
