function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function collectionValue(results: Record<string, unknown> | undefined, key: string) {
  const entry = results?.[key];
  if (typeof entry === "string") return asString(entry);
  const nested = record(entry);
  return asString(nested?.value) ?? asString(nested?.result);
}

/** ElevenLabs uses ISO codes (`en`, `es`) and sometimes a locale (`en-US`). */
export function canonicalLanguage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase().replace(/_/g, "-");
  if (!key) return undefined;
  if (key === "en" || key.startsWith("en-") || key.includes("english")) return "English";
  if (key === "es" || key.startsWith("es-") || key.includes("span")) return "Spanish";
  return value.trim();
}

const SPANISH_WORDS = new Set([
  "hola", "gracias", "quiero", "queria", "pedido", "pedir", "realizar", "por", "favor",
  "una", "uno", "un", "del", "para", "con", "que", "como", "algo", "mas", "tambien",
  "hamburguesa", "hamburguesas", "ensalada", "cuenta", "mesa", "vale", "claro", "dime",
  "tenemos", "cual", "prefieres", "anadir", "gustaria", "primero", "perfecto", "varias",
  "gusta", "quisiera", "bueno", "aqui", "ahora", "pero", "porque", "cuando", "donde",
  "cuanto", "esta", "este", "eso", "nada", "luego", "de", "el", "la", "los", "las",
]);

const STRONG_SPANISH = new Set([
  "hola", "gracias", "quiero", "queria", "pedido", "pedir", "hamburguesa", "hamburguesas",
  "quisiera", "gustaria", "dime", "favor",
]);

const ENGLISH_WORDS = new Set([
  "the", "hello", "hi", "hey", "thanks", "thank", "please", "want", "would", "like",
  "can", "have", "with", "and", "for", "this", "that", "welcome", "ready", "pleasure",
  "your", "you", "there", "whenever", "happy", "take", "our", "its", "to", "of", "my",
  "an", "is", "it", "we",
]);

const STRONG_ENGLISH = new Set([
  "hello", "hi", "hey", "please", "thanks", "thank", "want", "would", "the",
]);

type SpeechTurn = { role: "guest" | "agent"; text: string };

function speechTurns(value: unknown): SpeechTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: SpeechTurn[] = [];
  for (const turn of value) {
    const item = record(turn);
    if (!item) continue;
    const text = asString(item.message) ?? asString(item.text);
    if (!text || text.startsWith("[tool_")) continue;
    const roleName = (asString(item.role) ?? "").toLowerCase();
    turns.push({
      role: roleName === "user" || roleName === "guest" ? "guest" : "agent",
      text,
    });
  }
  return turns;
}

function turnsFromTranscript(transcript: string): SpeechTurn[] {
  return transcript.split("\n").flatMap((line) => {
    const match = line.match(/^(agent|assistant|user|guest)\s*:\s*(.*)$/i);
    if (!match) return [];
    const text = match[2]?.trim();
    if (!text || text.startsWith("[tool_")) return [];
    const role = /user|guest/i.test(match[1] ?? "") ? "guest" : "agent";
    return [{ role, text }];
  });
}

function scoreSpeech(text: string) {
  const folded = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = folded.split(/[^a-z]+/).filter(Boolean);
  let spanish = 0;
  let english = 0;
  let strongSpanish = 0;
  let strongEnglish = 0;
  for (const word of words) {
    if (SPANISH_WORDS.has(word)) spanish += 1;
    if (STRONG_SPANISH.has(word)) strongSpanish += 1;
    if (ENGLISH_WORDS.has(word)) english += 1;
    if (STRONG_ENGLISH.has(word)) strongEnglish += 1;
  }
  return { spanish, english, strongSpanish, strongEnglish };
}

function decideSpeech(score: ReturnType<typeof scoreSpeech>): "English" | "Spanish" | undefined {
  const spanishWins = score.spanish > score.english && (score.spanish >= 2 || score.strongSpanish >= 1);
  const englishWins = score.english > score.spanish && (score.english >= 2 || score.strongEnglish >= 1);
  if (spanishWins) return "Spanish";
  if (englishWins) return "English";
  return undefined;
}

function languageTagOnUserTurns(value: unknown): "English" | "Spanish" | undefined {
  if (!Array.isArray(value)) return undefined;
  const counts = new Map<string, number>();
  for (const turn of value) {
    const item = record(turn);
    if (!item) continue;
    const roleName = (asString(item.role) ?? "").toLowerCase();
    if (roleName !== "user" && roleName !== "guest") continue;
    const tagged = canonicalLanguage(
      asString(item.language) ?? asString(item.locale) ?? asString(item.detected_language)
    );
    if (!tagged) continue;
    counts.set(tagged, (counts.get(tagged) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [language, count] of counts) {
    if (count > bestCount) {
      best = language;
      bestCount = count;
    }
  }
  return best === "English" || best === "Spanish" ? best : undefined;
}

/** Language the guest spoke. Agent lines are not counted. */
export function languageFromTurns(turns: SpeechTurn[], rawTurns?: unknown): "English" | "Spanish" | undefined {
  const guest = turns.filter((turn) => turn.role === "guest").map((turn) => turn.text).join(" ");
  return decideSpeech(scoreSpeech(guest)) ?? languageTagOnUserTurns(rawTurns);
}

export function languageFromConversation(
  transcript: string | null | undefined,
  metadata: unknown
): "English" | "Spanish" | undefined {
  const stored = record(metadata);
  const rawTurns = stored?.transcriptTurns;
  const turns = speechTurns(rawTurns);
  const parsed = turns.length ? turns : transcript ? turnsFromTranscript(transcript) : [];
  return languageFromTurns(parsed, turns.length ? rawTurns : undefined);
}

/**
 * Language from an ElevenLabs post-call body or a Get Conversation response.
 * This is the user's language. The agent voice is not used.
 */
export function extractConversationLanguage(payload: unknown): string | undefined {
  const root = record(payload);
  if (!root) return undefined;
  const data = record(root.data) ?? root;
  const spoken = languageFromTurns(speechTurns(data.transcript), data.transcript);
  if (spoken) return spoken;

  const meta = record(data.metadata) ?? {};
  const client = record(data.conversation_initiation_client_data) ?? {};
  const dynamic = record(client.dynamic_variables) ?? {};
  const analysis = record(data.analysis) ?? {};
  const collection = record(analysis.data_collection_results);

  const raw =
    collectionValue(collection, "user_language") ??
    collectionValue(collection, "language") ??
    asString(dynamic.user_language) ??
    asString(dynamic.language) ??
    asString(meta.main_language) ??
    asString(data.main_language);

  return canonicalLanguage(raw);
}

export function languageFromStoredMetadata(metadata: unknown): string | undefined {
  const stored = record(metadata);
  if (!stored) return undefined;
  return (
    extractConversationLanguage({
      metadata: stored.rawMetadata,
      conversation_initiation_client_data: stored.conversationInitiation,
      main_language: stored.mainLanguage,
    }) ?? canonicalLanguage(asString(stored.mainLanguage))
  );
}

export async function fetchElevenLabsLanguage(
  conversationId: string
): Promise<{ language?: string; checked: boolean }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { checked: false };

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      {
        headers: { "xi-api-key": apiKey },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (upstream.status === 401 || upstream.status === 403 || upstream.status >= 500) {
      return { checked: false };
    }
    if (!upstream.ok) return { checked: true };
    return { language: extractConversationLanguage(await upstream.json()), checked: true };
  } catch (error) {
    console.warn(`ElevenLabs language lookup failed for ${conversationId}`, error);
    return { checked: false };
  }
}
