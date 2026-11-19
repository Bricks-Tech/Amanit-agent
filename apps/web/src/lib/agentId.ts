/** Unwrap accidental id+id env pastes; keep a single agent_… value. */
export function normalizeAgentId(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (value.length % 2 === 0) {
    const half = value.slice(0, value.length / 2);
    if (half && half + half === value) return half;
  }
  return value;
}
