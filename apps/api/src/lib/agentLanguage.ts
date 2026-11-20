export type AgentLanguage = {
  /** ElevenLabs agent language code */
  code: "en" | "es";
  /** Label used in dashboard / prompts */
  label: "English" | "Spanish";
};

const WELCOME_EN =
  "Hi, my name is Sophie and I will be taking your order today. Let me know when you're ready or have any questions about the menu.";

const WELCOME_ES =
  "Hola, me llamo Sophie y hoy tomaré su pedido. Avíseme cuando esté listo o si tiene alguna pregunta sobre el menú.";

export function welcomeMessageForLanguage(language: AgentLanguage): string {
  return language.code === "en" ? WELCOME_EN : WELCOME_ES;
}

export function resolveAgentLanguage(raw: unknown, fallbackRaw?: unknown): AgentLanguage {
  const parsed = parseLanguage(raw) ?? parseLanguage(fallbackRaw);
  if (parsed) return parsed;

  const envDefault = process.env.ELEVENLABS_DEFAULT_LANGUAGE?.trim() || "es";
  return parseLanguage(envDefault) ?? { code: "es", label: "Spanish" };
}

function parseLanguage(raw: unknown): AgentLanguage | null {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase().replace(/_/g, "-");
  if (!value) return null;
  if (value === "en" || value.startsWith("en-") || value.includes("english")) {
    return { code: "en", label: "English" };
  }
  if (
    value === "es" ||
    value.startsWith("es-") ||
    value.includes("span") ||
    value.includes("castell")
  ) {
    return { code: "es", label: "Spanish" };
  }
  return null;
}
