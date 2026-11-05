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

/**
 * Language from an ElevenLabs post-call body or a Get Conversation response.
 * The agent voice language wins when the call overrides it. Otherwise use
 * metadata.main_language, which ElevenLabs sets for the conversation.
 */
export function extractConversationLanguage(payload: unknown): string | undefined {
  const root = record(payload);
  if (!root) return undefined;
  const data = record(root.data) ?? root;
  const meta = record(data.metadata) ?? {};
  const client = record(data.conversation_initiation_client_data) ?? {};
  const override = record(client.conversation_config_override) ?? {};
  const agent = record(override.agent) ?? {};
  const dynamic = record(client.dynamic_variables) ?? {};
  const analysis = record(data.analysis) ?? {};
  const collection = record(analysis.data_collection_results);

  const raw =
    asString(agent.language) ??
    asString(meta.main_language) ??
    collectionValue(collection, "language") ??
    asString(dynamic.language) ??
    asString(dynamic.system__language) ??
    asString(meta.language) ??
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
