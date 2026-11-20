import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { fetchPublicConfig } from "../api";
import { normalizeAgentId } from "../lib/agentId";
import { normalizeTableNumber, tableNumberFromSearch } from "../lib/tableNumber";
import {
  languageFromCode,
  resolveWidgetLanguage,
  welcomeMessageForLanguage,
  type WidgetLanguage,
} from "../lib/widgetLanguage";

const DEFAULT_TABLE_NUMBER = "0";

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
  const hostRef = useRef<HTMLDivElement | null>(null);

  const presetTable = useMemo(
    () => tableNumberFromSearch(location.search) ?? DEFAULT_TABLE_NUMBER,
    [location.search]
  );
  const presetLanguage = useMemo(
    () =>
      resolveWidgetLanguage(
        location.search,
        typeof navigator !== "undefined" ? navigator.language : undefined
      ),
    [location.search]
  );

  const [draftTable, setDraftTable] = useState(presetTable);
  const [draftLang, setDraftLang] = useState<"en" | "es">(presetLanguage.code);
  const [ready, setReady] = useState(false);
  const [tableNumber, setTableNumber] = useState(presetTable);
  const [language, setLanguage] = useState<WidgetLanguage>(presetLanguage);

  useEffect(() => {
    setDraftTable(presetTable);
    setDraftLang(presetLanguage.code);
  }, [presetTable, presetLanguage]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicConfig()
      .then((config) => {
        if (cancelled) return;
        setAgentId(resolveAgentId(config.agentId));
      })
      .catch(() => {
        if (cancelled) return;
        setAgentId(normalizeAgentId(import.meta.env.VITE_ELEVENLABS_AGENT_ID));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !agentId || !ready) return;

    host.replaceChildren();
    const welcomeMessage = welcomeMessageForLanguage(language);
    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", agentId);
    widget.setAttribute("override-language", language.code);
    widget.setAttribute("override-first-message", welcomeMessage);
    widget.setAttribute(
      "dynamic-variables",
      JSON.stringify({
        table_number: tableNumber,
        language: language.label,
        user_language: language.label,
        welcome_message: welcomeMessage,
      })
    );
    host.appendChild(widget);

    return () => {
      host.replaceChildren();
    };
  }, [agentId, ready, tableNumber, language]);

  function startCall(event: FormEvent) {
    event.preventDefault();
    const nextTable = normalizeTableNumber(draftTable) ?? DEFAULT_TABLE_NUMBER;
    const nextLanguage = languageFromCode(draftLang);
    setTableNumber(nextTable);
    setLanguage(nextLanguage);
    setReady(true);
  }

  function changeSettings() {
    setReady(false);
  }

  if (!agentId) return null;

  return (
    <div className="voice-widget-root">
      {!ready ? (
        <form className="voice-setup" onSubmit={startCall}>
          <p className="voice-setup__title">Before you call</p>
          <label className="voice-setup__field">
            <span>Table number</span>
            <input
              value={draftTable}
              onChange={(e) => setDraftTable(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 7"
              aria-label="Table number"
              required
            />
          </label>
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
            Continue
          </button>
        </form>
      ) : (
        <button type="button" className="voice-setup-chip" onClick={changeSettings}>
          Table {tableNumber} · {language.label} · change
        </button>
      )}
      <div ref={hostRef} className="voice-widget-host" aria-hidden={!ready} />
    </div>
  );
}
