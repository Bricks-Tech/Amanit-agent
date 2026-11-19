export function normalizeTableNumber(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (!/^[A-Za-z0-9-]{1,12}$/.test(value)) return null;
  return value;
}

export function tableNumberFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return (
    normalizeTableNumber(params.get("table")) ??
    normalizeTableNumber(params.get("table_number"))
  );
}
