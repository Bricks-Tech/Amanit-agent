import { Router } from "express";
import { OrderStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireWebhookSecret } from "../lib/webhookAuth.js";

export const toolsRouter = Router();

toolsRouter.use(requireWebhookSecret);

const itemSchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  price_euros: z.coerce.number().nonnegative().optional(),
  price: z.coerce.number().nonnegative().optional(),
  price_cents: z.coerce.number().int().nonnegative().optional(),
  priceCents: z.coerce.number().int().nonnegative().optional(),
});

/** Table number (7) or label ("Table 7" / "7") from the voice agent. */
const tableField = z.union([z.string(), z.number()]).optional();

const createOrderSchema = z.object({
  table: tableField,
  table_label: tableField,
  tableLabel: tableField,
  customer_name: z.string().optional(),
  customerName: z.string().optional(),
  customer_phone: z.string().optional(),
  customerPhone: z.string().optional(),
  language: z.string().optional(),
  // Prefer "instructions" (ElevenLabs tool); "notes" kept as alias
  instructions: z.string().optional(),
  notes: z.string().optional(),
  conversation_id: z.string().optional(),
  conversationId: z.string().optional(),
  // ElevenLabs tool often sends items as one LLM string
  items: z.union([z.array(itemSchema), z.string().min(1)]).optional(),
  item_name: z.string().optional(),
  item_quantity: z.coerce.number().int().positive().optional(),
  item_price_euros: z.coerce.number().nonnegative().optional(),
});

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Normalize table from tool: 7 / "7" / "Table 7" → stored as "7".
 * Listing UI prepends "Table " for display.
 */
function normalizeTableLabel(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return String(Math.trunc(value));
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const stripped = trimmed.replace(/^table\s+/i, "").trim();
  if (/^\d+$/.test(stripped)) return stripped;
  return trimmed;
}

function toPriceCents(item: z.infer<typeof itemSchema>): number {
  if (typeof item.price_cents === "number") return item.price_cents;
  if (typeof item.priceCents === "number") return item.priceCents;
  if (typeof item.price_euros === "number") return Math.round(item.price_euros * 100);
  if (typeof item.price === "number") {
    return item.price < 1000 ? Math.round(item.price * 100) : Math.round(item.price);
  }
  return 0;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );
}

/** ElevenLabs may send flat body or { parameters, conversation_id, tool_name, ... }. */
function normalizeToolBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const body = raw as Record<string, unknown>;
  const params =
    body.parameters && typeof body.parameters === "object"
      ? (body.parameters as Record<string, unknown>)
      : {};

  return {
    ...params,
    ...body,
    // Prefer top-level conversation_id from ElevenLabs envelope
    conversation_id:
      asString(body.conversation_id) ??
      asString(body.conversationId) ??
      asString(params.conversation_id) ??
      asString(params.conversationId),
  };
}

function resolveConversationId(
  body: Record<string, unknown>,
  req: import("express").Request
): string | undefined {
  return (
    asString(body.conversation_id) ??
    asString(body.conversationId) ??
    asString(req.header("x-conversation-id")) ??
    asString(req.header("elevenlabs-conversation-id"))
  );
}

/**
 * ElevenLabs webhook tool: create an order from the voice agent.
 *
 * POST /tools/create-order
 * Header: x-webhook-secret: <WEBHOOK_SECRET>
 */
toolsRouter.post("/create-order", async (req, res) => {
  const normalized = normalizeToolBody(req.body);
  const parsed = createOrderSchema.safeParse(normalized);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Invalid order payload",
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  let items: Array<{ name: string; quantity: number; priceCents: number }> = [];

  if (Array.isArray(data.items)) {
    items = data.items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      priceCents: toPriceCents(item),
    }));
  } else if (typeof data.items === "string" && data.items.trim()) {
    // Store the LLM-extracted order text as one line item (matches your existing tool)
    items = [{ name: data.items.trim(), quantity: 1, priceCents: 0 }];
  } else if (data.item_name) {
    items = [
      {
        name: data.item_name.trim(),
        quantity: data.item_quantity ?? 1,
        priceCents:
          typeof data.item_price_euros === "number"
            ? Math.round(data.item_price_euros * 100)
            : 0,
      },
    ];
  }

  if (!items.length) {
    return res.status(400).json({
      ok: false,
      error: "At least one item is required (items or item_name)",
    });
  }

  const tableLabel = normalizeTableLabel(
    data.table_label ?? data.tableLabel ?? data.table
  );
  const customerName =
    data.customer_name ??
    data.customerName ??
    (tableLabel ? `Table ${tableLabel}` : undefined);
  const customerPhone = data.customer_phone ?? data.customerPhone;
  const instructions = data.instructions ?? data.notes;
  const conversationExternalId = resolveConversationId(normalized, req);
  const totalCents = items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);

  let conversationId: string | undefined;
  let language = data.language;
  if (conversationExternalId) {
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [{ id: conversationExternalId }, { externalId: conversationExternalId }],
      },
    });
    if (existing) {
      conversationId = existing.id;
      language = data.language ?? existing.language ?? undefined;
    } else {
      const created = await prisma.conversation.create({
        data: {
          externalId: conversationExternalId,
          tableLabel,
          language,
          callerName: customerName,
          status: "in_progress",
          summary: `Order in progress: ${items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}`,
        },
      });
      conversationId = created.id;
    }
  }

  const externalId = `O-${Date.now().toString().slice(-6)}`;

  const order = await prisma.order.create({
    data: {
      externalId,
      conversationId,
      customerName,
      customerPhone,
      tableLabel,
      language,
      notes: instructions,
      items: items as unknown as Prisma.InputJsonValue,
      totalCents,
      status: OrderStatus.PENDING,
    },
  });

  const summary = items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name)).join(", ");
  const tableDisplay = tableLabel ? `Table ${tableLabel}` : null;
  const message = `Order ${order.externalId} placed successfully${
    tableDisplay ? ` for ${tableDisplay}` : ""
  }: ${summary}${instructions ? `. Instructions: ${instructions}` : ""}${
    totalCents > 0 ? `. Total ${formatMoney(totalCents)}` : ""
  }.`;

  // Include `result` for ElevenLabs tool response conventions
  return res.status(201).json({
    ok: true,
    result: message,
    order_id: order.externalId,
    order_db_id: order.id,
    conversation_id: conversationExternalId ?? null,
    table: tableDisplay,
    table_number: tableLabel ?? null,
    total: totalCents > 0 ? formatMoney(totalCents) : null,
    total_cents: totalCents,
    items: summary,
    instructions: instructions ?? null,
    status: order.status,
    message,
  });
});
