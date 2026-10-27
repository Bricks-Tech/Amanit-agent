export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatWhen(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** 24h time e.g. 21:43 — matches Orders Figma listing */
export function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/** Date e.g. 19 Oct 2026 — matches Orders Figma listing */
export function formatDateShort(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDuration(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeTime(value?: string | null) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatWhen(value);
}

export function itemCount(items: unknown) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const quantity = Number((item as { quantity?: unknown }).quantity ?? 1);
    return sum + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
}

/** Display table: 7 / "7" / "Table 7" → "Table 7" */
export function formatTableLabel(
  tableLabel?: string | null,
  fallback?: string | null
) {
  const raw = (tableLabel ?? fallback ?? "").trim();
  if (!raw) return "Unavailable";
  if (/^table\s+/i.test(raw)) return raw.replace(/^table\s+/i, "Table ");
  if (/^\d+$/.test(raw)) return `Table ${raw}`;
  return raw;
}
