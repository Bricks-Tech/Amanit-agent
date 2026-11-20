export type WidgetLanguage = {
  code: "en" | "es";
  label: "English" | "Spanish";
};

const WELCOME_EN =
  "Hi, my name is Sophie and I will be taking your order today. Let me know when you're ready or have any questions about the menu.";

const WELCOME_ES =
  "Hola, me llamo Sophie y hoy tomaré su pedido. Avíseme cuando esté listo o si tiene alguna pregunta sobre el menú.";

export function welcomeMessageForLanguage(language: WidgetLanguage): string {
  return language.code === "en" ? WELCOME_EN : WELCOME_ES;
}

export function languageFromCode(code: "en" | "es"): WidgetLanguage {
  return code === "en"
    ? { code: "en", label: "English" }
    : { code: "es", label: "Spanish" };
}

/** Prefer Spanish for es-* browsers; otherwise English. URL ?lang=es|en overrides. */
export function resolveWidgetLanguage(search: string, browserLanguage?: string): WidgetLanguage {
  const params = new URLSearchParams(search);
  const fromQuery = parse(params.get("lang") ?? params.get("language"));
  if (fromQuery) return fromQuery;

  const fromBrowser = parse(browserLanguage);
  if (fromBrowser) return fromBrowser;

  return { code: "es", label: "Spanish" };
}

function parse(raw: string | null | undefined): WidgetLanguage | null {
  const value = (raw ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!value) return null;
  if (value === "en" || value.startsWith("en-") || value.includes("english")) {
    return { code: "en", label: "English" };
  }
  if (value === "es" || value.startsWith("es-") || value.includes("span")) {
    return { code: "es", label: "Spanish" };
  }
  return null;
}
