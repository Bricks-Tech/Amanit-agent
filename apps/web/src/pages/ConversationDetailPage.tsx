import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchConversation, fetchConversationAudio, type Conversation } from "../api";
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
  transcriptTurns,
  turnClock,
} from "../lib/conversationView";
import { formatDuration } from "../lib/format";
import { waveformPeaks } from "../lib/waveform";

const PLACEHOLDER_PEAKS = [0.35, 0.55, 0.4, 0.7, 0.5, 0.85, 0.45, 0.6, 0.38, 0.72, 0.5, 0.66];

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M4.2 2.4v9.2L11.2 7 4.2 2.4z" fill="white" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.5 2.3h2.3v9.4H3.5V2.3zm4.7 0h2.3v9.4H8.2V2.3z" fill="white" />
    </svg>
  );
}

export function ConversationDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    fetchConversation(token, id)
      .then((res) => setConversation(res.conversation))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return;
    let objectUrl = "";
    let cancelled = false;
    setAudioSrc(null);
    setAudioError(null);
    setPeaks([]);
    setPlaying(false);
    setElapsed(0);
    fetchConversationAudio(token, id)
      .then(async (blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAudioSrc(objectUrl);
        const nextPeaks = await waveformPeaks(blob);
        if (!cancelled && nextPeaks.length) setPeaks(nextPeaks);
      })
      .catch(() => {
        if (!cancelled) setAudioError("No recording was saved for this call.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
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
  const duration = mediaDuration || conversation.durationSeconds || 0;
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }
    if (audio.ended) audio.currentTime = 0;
    void audio.play().catch(() => {
      setPlaying(false);
      setAudioError("Couldn’t play this recording.");
    });
  }

  function seek(event: MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setElapsed(audio.currentTime);
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
            <div className={playing ? "conv-player is-playing" : "conv-player"}>
              <button
                type="button"
                className="conv-play"
                onClick={togglePlayback}
                disabled={!audioSrc}
                aria-label={playing ? "Pause" : "Play"}
                aria-pressed={playing}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <span className="conv-elapsed">{formatDuration(elapsed)}</span>
              <div
                className="conv-wave"
                role="slider"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(elapsed)}
                aria-label="Recording position"
                onClick={seek}
              >
                {(peaks.length ? peaks : PLACEHOLDER_PEAKS).map((peak, index, all) => {
                  const played = (index + 0.5) / all.length <= progress;
                  const playhead = Math.floor(progress * all.length);
                  const live = playing && Math.abs(index - playhead) <= 1;
                  return (
                    <span
                      key={index}
                      className={
                        live ? "conv-wave-bar played live" : played ? "conv-wave-bar played" : "conv-wave-bar"
                      }
                      style={{ height: `${Math.round(6 + peak * 28)}px` }}
                    />
                  );
                })}
              </div>
              <span className="conv-total">{formatDuration(duration || conversation.durationSeconds)}</span>
              {audioSrc ? (
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  preload="auto"
                  onLoadedMetadata={(event) => {
                    const next = event.currentTarget.duration;
                    if (Number.isFinite(next)) setMediaDuration(next);
                  }}
                  onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                />
              ) : null}
            </div>
            {audioError ? <p className="conv-audio-error">{audioError}</p> : null}
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
