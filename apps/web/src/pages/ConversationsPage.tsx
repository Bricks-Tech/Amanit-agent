import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchConversations, type Conversation } from "../api";
import { useAuth } from "../auth";
import { PeriodTabs, type Period } from "../components/PeriodTabs";
import {
  conversationCode,
  conversationTitle,
  displayLanguage,
  formatListWhen,
  isDropped,
  isEnglish,
  languageMic,
  orderSummary,
} from "../lib/conversationView";
import { formatDuration } from "../lib/format";

const PAGE_SIZE = 10;

function startOfPeriod(period: Period) {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function ConversationsPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<Period>("today");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchConversations(token)
      .then((res) => setConversations(res.conversations))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  useEffect(() => {
    setPage(0);
  }, [period, query, language]);

  const filtered = useMemo(() => {
    const start = startOfPeriod(period).getTime();
    return conversations.filter((conversation) => {
      const when = new Date(conversation.startedAt ?? conversation.createdAt).getTime();
      if (when < start) return false;
      const haystack = [
        conversation.tableLabel,
        conversation.callerName,
        conversation.externalId,
        conversationCode(conversation),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const lang = displayLanguage(conversation.language).toLowerCase();
      const matchesLanguage = language === "all" || lang === language;
      return matchesQuery && matchesLanguage;
    });
  }, [conversations, query, language, period]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length ? safePage * PAGE_SIZE + 1 : 0;
  const to = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);
  const periodLabel = period === "today" ? "today" : period === "week" ? "this week" : "this month";

  return (
    <>
      <header className="page-header">
        <h1>Conversations</h1>
        <p>Recordings and transcripts of guest conversations at Amanit Sitges</p>
      </header>
      <div className="toolbar conv-toolbar">
        <PeriodTabs value={period} onChange={setPeriod} />
        <div className="toolbar-right">
          <label className="conv-search">
            <img src="/assets/conv-search.svg" alt="" width={16} height={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search table or conversation ID"
            />
          </label>
          <label className="conv-language">
            <img src="/assets/conv-filter.svg" alt="" width={16} height={16} />
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="all">All languages</option>
              <option value="spanish">Spanish</option>
              <option value="english">English</option>
            </select>
            <img src="/assets/conv-chevron.svg" alt="" width={16} height={16} />
          </label>
        </div>
      </div>
      <div className="content-pad">
        {error ? <p className="form-error">{error}</p> : null}
        <section className="conv-card">
          <div className="conv-card-head">
            <h2>All Conversations</h2>
            <p>
              {filtered.length} conversation{filtered.length === 1 ? "" : "s"} {periodLabel}
            </p>
          </div>
          <ul className="conv-rows">
            {pageRows.map((conversation) => {
              const dropped = isDropped(conversation);
              const when = conversation.startedAt ?? conversation.createdAt;
              return (
                <li key={conversation.id}>
                  <Link className="conv-row" to={`/dashboard/conversations/${conversation.id}`}>
                    <span className={dropped ? "conv-mark dropped" : "conv-mark"}>
                      <img
                        src={dropped ? "/assets/conv-dropped.svg" : "/assets/conv-order.svg"}
                        alt=""
                        width={20}
                        height={20}
                      />
                    </span>
                    <span className="conv-row-main">
                      <span className="conv-row-title">
                        <strong>{conversationTitle(conversation)}</strong>
                        {conversation.language ? (
                          <span className={isEnglish(conversation.language) ? "conv-lang english" : "conv-lang"}>
                            <img
                              src={languageMic(conversation.language)}
                              alt=""
                              width={12}
                              height={12}
                            />
                            {displayLanguage(conversation.language)}
                          </span>
                        ) : null}
                        <span className={dropped ? "conv-id muted" : "conv-id"}>
                          {conversationCode(conversation)}
                        </span>
                      </span>
                      <span className="conv-row-summary">{orderSummary(conversation)}</span>
                    </span>
                    <span className="conv-row-meta">
                      <span>{formatListWhen(when)}</span>
                      <span className="conv-duration">
                        <img src="/assets/conv-clock.svg" alt="" width={14} height={14} />
                        {formatDuration(conversation.durationSeconds)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {!filtered.length ? <p className="empty">No conversations match.</p> : null}
          <div className="conv-pager">
            <span>
              Showing {from}–{to} of {filtered.length}
            </span>
            <div>
              <button
                type="button"
                className="conv-page-btn"
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="conv-page-btn"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
