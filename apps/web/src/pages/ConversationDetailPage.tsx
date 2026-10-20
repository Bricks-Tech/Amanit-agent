import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchConversation, type Conversation } from "../api";
import { useAuth } from "../auth";
import {
  conversationCode,
  conversationTitle,
  displayLanguage,
  formatListWhen,
  formatOrderMoney,
  formatStarted,
  isDropped,
  isEnglish,
  languageMic,
  orderItems,
  orderStatusLabel,
  recordingUrl,
  transcriptTurns,
  turnClock,
} from "../lib/conversationView";
import { formatDuration } from "../lib/format";

export function ConversationDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    fetchConversation(token, id)
      .then((res) => setConversation(res.conversation))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token, id]);

  if (error) {
    return (
      <div className="content-pad">
        <p className="form-error">{error}</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="content-pad">
        <p className="empty">Loading conversation…</p>
      </div>
    );
  }

  const dropped = isDropped(conversation);
  const when = conversation.startedAt ?? conversation.createdAt;
  const turns = transcriptTurns(conversation);
  const order = conversation.orders?.[0] ?? null;
  const items = order ? orderItems(order.items) : [];
  const audioSrc = recordingUrl(conversation.metadata);
  const duration = conversation.durationSeconds ?? 0;
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <header className="conv-detail-header">
        <div>
          <Link className="conv-back" to="/dashboard/conversations">
            <img src="/assets/conv-back.svg" alt="" width={16} height={16} />
            Conversations
          </Link>
          <div className="conv-detail-title">
            <h1>{conversationTitle(conversation)}</h1>
            {conversation.language ? (
              <span className={isEnglish(conversation.language) ? "conv-lang english" : "conv-lang"}>
                <img src={languageMic(conversation.language)} alt="" width={12} height={12} />
                {displayLanguage(conversation.language)}
              </span>
            ) : null}
          </div>
          <p>
            Conversation {conversationCode(conversation)} · {formatListWhen(when)} ·{" "}
            {formatDuration(conversation.durationSeconds)}
          </p>
        </div>
        {order ? (
          <Link className="conv-view-order" to="/dashboard/orders">
            View order #{order.externalId ?? order.id.slice(0, 6)}
            <img src="/assets/conv-arrow.svg" alt="" width={16} height={16} />
          </Link>
        ) : null}
      </header>

      <div className="conv-detail-grid">
        <div className="conv-detail-main">
          <section className="conv-panel conv-recording">
            <h2>Recording</h2>
            <div className="conv-player">
              <button type="button" className="conv-play" onClick={togglePlayback} disabled={!audioSrc}>
                <img src="/assets/conv-pause.svg" alt="" width={14} height={14} />
                <span className="sr-only">{playing ? "Pause" : "Play"}</span>
              </button>
              <span className="conv-elapsed">{formatDuration(Math.floor(elapsed))}</span>
              <div className="conv-track" aria-hidden="true">
                <span className="conv-track-fill" style={{ width: `${progress * 100}%` }} />
                <span className="conv-track-knob" style={{ left: `${progress * 100}%` }} />
              </div>
              <span className="conv-total">{formatDuration(conversation.durationSeconds)}</span>
              {audioSrc ? (
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  preload="metadata"
                  onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
                  onEnded={() => setPlaying(false)}
                />
              ) : null}
            </div>
          </section>

          <section className="conv-panel conv-transcript">
            <div className="conv-transcript-head">
              <h2>Transcript</h2>
              <p>
                {turns.length} turn{turns.length === 1 ? "" : "s"}
                {conversation.language ? ` · ${displayLanguage(conversation.language)}` : ""}
              </p>
            </div>
            <div className="conv-turns">
              {turns.map((turn, index) => (
                <div key={`${turn.role}-${index}`} className={turn.role === "agent" ? "conv-turn agent" : "conv-turn"}>
                  <p>
                    {turn.role === "agent" ? "Agent" : "Guest"} · {turnClock(turn.seconds)}
                  </p>
                  <div>{turn.text}</div>
                </div>
              ))}
              {!turns.length ? <p className="empty">No transcript.</p> : null}
            </div>
          </section>
        </div>

        <aside className="conv-detail-side">
          <section className="conv-panel conv-details">
            <h2>Details</h2>
            <dl>
              <div>
                <dt>Table</dt>
                <dd>{conversationTitle(conversation)}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatStarted(when)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(conversation.durationSeconds)}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{displayLanguage(conversation.language)}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd className={dropped ? "outcome dropped" : "outcome"}>{dropped ? "Dropped" : "Order sent"}</dd>
              </div>
              <div>
                <dt>Conversation ID</dt>
                <dd>{conversationCode(conversation)}</dd>
              </div>
            </dl>
          </section>

          {order ? (
            <section className="conv-panel conv-order-card">
              <div className="conv-order-head">
                <h2>Order #{order.externalId ?? order.id.slice(0, 6)}</h2>
                <span className={order.status === "CANCELLED" ? "conv-status cancelled" : "conv-status"}>
                  <i />
                  {orderStatusLabel(order.status)}
                </span>
              </div>
              <ul>
                {items.map((item) => (
                  <li key={`${item.name}-${item.quantity}`}>
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span>{formatOrderMoney(item.priceCents * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="conv-order-total">
                <span>Total</span>
                <strong>{formatOrderMoney(order.totalCents)}</strong>
              </div>
              <Link className="conv-order-link" to="/dashboard/orders">
                View order
                <img src="/assets/conv-arrow-teal.svg" alt="" width={16} height={16} />
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
