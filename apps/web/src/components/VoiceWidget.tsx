import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { fetchPublicConfig } from "../api";
import { normalizeAgentId } from "../lib/agentId";
import {
  languageFromCode,
  resolveWidgetLanguage,
  welcomeMessageForLanguage,
  type WidgetLanguage,
} from "../lib/widgetLanguage";

const FALLBACK_TABLE_NUMBER = "0";

function resolveAgentId(fromApi: string | null | undefined) {
  return (
    normalizeAgentId(fromApi) ??
    normalizeAgentId(import.meta.env.VITE_ELEVENLABS_AGENT_ID)
  );
}

export function VoiceWidget() {
  const location = useLocation();
  const [agentId, setAgentId] = useState<string | null>(() =>
    normalizeAgentId(import.meta.env.VITE_ELEVENLABS_AGENT_ID)
  );
  const [tableNumber, setTableNumber] = useState(FALLBACK_TABLE_NUMBER);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const presetLanguage = useMemo(
    () =>
      resolveWidgetLanguage(
        location.search,
        typeof navigator !== "undefined" ? navigator.language : undefined
      ),
    [location.search]
  );

  const [draftLang, setDraftLang] = useState<"en" | "es">(presetLanguage.code);
  const [session, setSession] = useState<{
    language: WidgetLanguage;
    key: number;
  } | null>(null);

  useEffect(() => {
    setDraftLang(presetLanguage.code);
  }, [presetLanguage]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicConfig()
      .then((config) => {
        if (cancelled) return;
        setAgentId(resolveAgentId(config.agentId));
        const fromApi = config.tableNumber?.trim();
        setTableNumber(fromApi || FALLBACK_TABLE_NUMBER);
      })
      .catch(() => {
        if (cancelled) return;
        setAgentId(normalizeAgentId(import.meta.env.VITE_ELEVENLABS_AGENT_ID));
        setTableNumber(FALLBACK_TABLE_NUMBER);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !agentId || !session) return;

    host.replaceChildren();
    const welcomeMessage = welcomeMessageForLanguage(session.language);
    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", agentId);
    widget.setAttribute("override-language", session.language.code);
    widget.setAttribute("override-first-message", welcomeMessage);
    widget.setAttribute(
      "dynamic-variables",
      JSON.stringify({
        table_number: tableNumber,
        language: session.language.label,
        user_language: session.language.label,
        welcome_message: welcomeMessage,
      })
    );
    host.appendChild(widget);

    return () => {
      host.replaceChildren();
    };
  }, [agentId, session, tableNumber]);

  function applyLanguage(event: FormEvent) {
    event.preventDefault();
    const nextLanguage = languageFromCode(draftLang);
    setSession((prev) => ({
      language: nextLanguage,
      key: (prev?.key ?? 0) + 1,
    }));
  }

  if (!agentId) return null;

  return (
    <div className="voice-widget-root">
      <form className="voice-setup" onSubmit={applyLanguage}>
        <p className="voice-setup__title">
          {session ? "Language" : "Before you call"}
        </p>
        <label className="voice-setup__field">
          <span>Language</span>
          <select
            value={draftLang}
            onChange={(e) => setDraftLang(e.target.value === "en" ? "en" : "es")}
            aria-label="Language"
          >
            <option value="es">Spanish</option>
            <option value="en">English</option>
          </select>
        </label>
        <button type="submit" className="voice-setup__start">
          {session ? "Apply" : "Continue"}
        </button>
      </form>
      <div ref={hostRef} className="voice-widget-host" aria-hidden={!session} />
    </div>
  );
}
