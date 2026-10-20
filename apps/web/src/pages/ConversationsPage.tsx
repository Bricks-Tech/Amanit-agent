import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchConversations, type Conversation } from "../api";
import { useAuth } from "../auth";
import { PeriodTabs, type Period } from "../components/PeriodTabs";
import { formatDuration, formatWhen } from "../lib/format";

export function ConversationsPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<Period>("today");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchConversations(token)
      .then((res) => {
        setConversations(res.conversations);
        setSelectedId(res.conversations[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  const filtered = useMemo(() => {
    return conversations.filter((conversation) => {
      const haystack = [
        conversation.tableLabel,
        conversation.callerName,
        conversation.externalId,
        conversation.summary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const matchesLanguage =
        language === "all" ||
        (conversation.language ?? "").toLowerCase() === language.toLowerCase();
      return matchesQuery && matchesLanguage;
    });
  }, [conversations, query, language, period]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  return (
    <>
      <header className="page-header">
        <h1>Conversations</h1>
        <p>Recordings and transcripts of guest conversations at Amanit Sitges</p>
      </header>
      <div className="toolbar">
        <PeriodTabs value={period} onChange={setPeriod} />
        <div className="toolbar-right">
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search table or conversation ID"
          />
          <select
            className="select-input"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="all">All languages</option>
            <option value="Spanish">Spanish</option>
            <option value="English">English</option>
          </select>
        </div>
      </div>
      <div className="content-pad">
        {error ? <p className="form-error">{error}</p> : null}
        <div className="conv-layout">
          <section className="panel-card">
            <h2>All Conversations</h2>
            <p className="sub">
              Showing {filtered.length} of {conversations.length}
            </p>
            <ul className="conversation-list">
              {filtered.map((conversation) => {
                const dropped =
                  conversation.status === "dropped" || !conversation.orders?.length;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      className={
                        conversation.id === selected?.id
                          ? "conversation-item active"
                          : "conversation-item"
                      }
                      onClick={() => setSelectedId(conversation.id)}
                    >
                      <div className={dropped ? "conversation-icon dropped" : "conversation-icon"}>
                        <img
                          src={dropped ? "/assets/icon-trend.svg" : "/assets/icon-bag.svg"}
                          alt=""
                          width={18}
                          height={18}
                        />
                      </div>
                      <div>
                        <div className="item-title">
                          <span>
                            {conversation.tableLabel ?? conversation.callerName ?? "Guest"}
                          </span>
                          {conversation.language ? (
                            <span
                              className={
                                conversation.language.toLowerCase() === "english"
                                  ? "lang-pill english"
                                  : "lang-pill"
                              }
                            >
                              {conversation.language}
                            </span>
                          ) : null}
                          {conversation.externalId ? (
                            <span className="item-summary">#{conversation.externalId}</span>
                          ) : null}
                        </div>
                        <p className="item-summary">{conversation.summary ?? "No summary"}</p>
                      </div>
                      <div className="item-meta">
                        <span>{formatWhen(conversation.createdAt)}</span>
                        <span>{formatDuration(conversation.durationSeconds)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
              {!filtered.length ? <li className="empty">No conversations match.</li> : null}
            </ul>
          </section>

          <section className="panel-card detail-block">
            {selected ? (
              <>
                <p className="sub">
                  <Link className="order-link" to="/dashboard/conversations">
                    Conversations
                  </Link>
                </p>
                <h2>{selected.tableLabel ?? selected.callerName ?? "Guest"}</h2>
                <p className="sub">
                  Conversation #{selected.externalId ?? selected.id.slice(0, 6)} ·{" "}
                  {formatWhen(selected.startedAt ?? selected.createdAt)} ·{" "}
                  {formatDuration(selected.durationSeconds)}
                </p>
                {selected.orders?.[0] ? (
                  <p>
                    <Link className="order-link" to="/dashboard/orders">
                      View order #{selected.orders[0].externalId ?? selected.orders[0].id.slice(0, 6)}
                    </Link>
                  </p>
                ) : null}
                <h3>Summary</h3>
                <p>{selected.summary ?? "No summary available."}</p>
                <h3>Transcript</h3>
                <pre className="transcript">{selected.transcript ?? "No transcript."}</pre>
              </>
            ) : (
              <p className="empty">Select a conversation to inspect it.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
