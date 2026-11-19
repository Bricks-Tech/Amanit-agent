import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchPublicConfig } from "../api";
import { normalizeAgentId } from "../lib/agentId";
import { tableNumberFromSearch } from "../lib/tableNumber";

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

  const tableNumber = useMemo(
    () => tableNumberFromSearch(location.search) ?? DEFAULT_TABLE_NUMBER,
    [location.search]
  );

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
    if (!host || !agentId) return;

    host.replaceChildren();
    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", agentId);
    widget.setAttribute(
      "dynamic-variables",
      JSON.stringify({ table_number: tableNumber })
    );
    host.appendChild(widget);

    return () => {
      host.replaceChildren();
    };
  }, [agentId, tableNumber]);

  if (!agentId) return null;

  return <div ref={hostRef} className="voice-widget-host" aria-hidden="true" />;
}
