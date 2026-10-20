import type { Conversation, OrderItem } from "../api";
import { formatDateShort, formatDuration, formatMoney, formatTableLabel, formatTime } from "./format";

export function isEnglish(language?: string | null) {
  const key = (language ?? "").toLowerCase();
  return key === "en" || key.includes("eng");
}

export function displayLanguage(language?: string | null) {
  if (!language) return "—";
  const key = language.toLowerCase();
  if (key === "es" || key.includes("span")) return "Spanish";
  if (isEnglish(language)) return "English";
  return language;
}

export function languageMic(language?: string | null) {
  return isEnglish(language) ? "/assets/conv-mic-en.svg" : "/assets/conv-mic-es.svg";
}

export function conversationTitle(conversation: Conversation) {
  const raw = (conversation.tableLabel ?? conversation.callerName ?? "").trim();
  if (!raw) return "Unknown table";
  return formatTableLabel(raw);
}

export function conversationCode(conversation: Conversation) {
  const raw = (conversation.externalId ?? conversation.id).replace(/^#/, "");
  if (raw.length <= 8) return `#${raw}`;
  return `#${raw.slice(-4)}`;
}

export function isDropped(conversation: Conversation) {
  return conversation.status === "dropped" || !conversation.orders?.length;
}

export function orderItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as {
      name?: unknown;
      quantity?: unknown;
      priceCents?: unknown;
      price_cents?: unknown;
      price_euros?: unknown;
      price?: unknown;
    };
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) return [];
    const quantity = Number(record.quantity ?? 1);
    let priceCents = 0;
    if (typeof record.priceCents === "number") priceCents = record.priceCents;
    else if (typeof record.price_cents === "number") priceCents = record.price_cents;
    else if (typeof record.price_euros === "number") priceCents = Math.round(record.price_euros * 100);
    else if (typeof record.price === "number") {
      priceCents = record.price < 1000 ? Math.round(record.price * 100) : Math.round(record.price);
    }
    return [
      {
        name,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        priceCents,
      },
    ];
  });
}

export function orderSummary(conversation: Conversation) {
  if (isDropped(conversation)) return "Conversation dropped - no order placed";
  const parts = (conversation.orders ?? []).flatMap((order) =>
    orderItems(order.items).map((item) => `${item.quantity}x ${item.name}`)
  );
  if (parts.length) return `Ordered ${parts.join(", ")}`;
  return conversation.summary ?? "No summary";
}

export function formatListWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  const time = formatTime(value);
  if (date.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${formatDateShort(value)}, ${time}`;
}

export function formatStarted(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(value))
    .replace(",", "");
}

export type TranscriptTurn = {
  role: "agent" | "guest";
  text: string;
  seconds: number | null;
};

export function transcriptTurns(conversation: Conversation): TranscriptTurn[] {
  const metadata = conversation.metadata;
  if (metadata && typeof metadata === "object") {
    const raw = (metadata as { transcriptTurns?: unknown }).transcriptTurns;
    if (Array.isArray(raw)) {
      const turns = raw.flatMap((turn) => normalizeTurn(turn));
      if (turns.length) return turns;
    }
  }

  if (!conversation.transcript) return [];
  return conversation.transcript.split("\n").flatMap((line) => {
    const match = line.match(/^(agent|assistant|user|guest)\s*:\s*(.*)$/i);
    if (!match) return [];
    const text = match[2]?.trim();
    if (!text || text.startsWith("[tool_")) return [];
    const role = /user|guest/i.test(match[1] ?? "") ? "guest" : "agent";
    return [{ role, text, seconds: null } satisfies TranscriptTurn];
  });
}

function normalizeTurn(turn: unknown): TranscriptTurn[] {
  if (!turn || typeof turn !== "object") return [];
  const record = turn as { role?: unknown; message?: unknown; text?: unknown; time_in_call_secs?: unknown };
  const text =
    (typeof record.message === "string" && record.message.trim()) ||
    (typeof record.text === "string" && record.text.trim()) ||
    "";
  if (!text) return [];
  const roleName = typeof record.role === "string" ? record.role.toLowerCase() : "";
  const role = roleName === "user" || roleName === "guest" ? "guest" : "agent";
  const seconds =
    typeof record.time_in_call_secs === "number" && Number.isFinite(record.time_in_call_secs)
      ? record.time_in_call_secs
      : null;
  return [{ role, text, seconds }];
}

export function turnClock(seconds: number | null) {
  if (seconds == null) return "0:00";
  return formatDuration(Math.round(seconds));
}

export function recordingUrl(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  for (const key of ["recordingUrl", "recording_url", "audioUrl", "audio_url"]) {
    const value = record[key];
    if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  }
  if (record.rawMetadata && typeof record.rawMetadata === "object") {
    return recordingUrl(record.rawMetadata);
  }
  return null;
}

export function orderStatusLabel(status: string) {
  if (status === "CANCELLED") return "Cancelled";
  return "Sent to Lightspeed";
}

export function formatOrderMoney(cents: number) {
  return formatMoney(cents);
}
