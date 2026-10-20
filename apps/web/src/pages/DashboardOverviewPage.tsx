import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchConversations, fetchOrders, type Conversation, type Order } from "../api";
import { useAuth } from "../auth";
import { PeriodTabs, type Period } from "../components/PeriodTabs";
import { formatMoney, relativeTime } from "../lib/format";

function chartPath(values: number[]) {
  const width = 1000;
  const height = 200;
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 20) - 10;
    return `${x},${y}`;
  });
  const line = points.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return { line, area };
}

function startOfPeriod(period: Period) {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function dailyConversationCounts(conversations: Conversation[], period: Period) {
  const start = startOfPeriod(period);
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  const buckets = Array.from({ length: days }, () => 0);

  for (const conversation of conversations) {
    const created = new Date(conversation.createdAt);
    if (created < start) continue;
    const index = Math.min(
      days - 1,
      Math.floor((created.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    );
    if (index >= 0) buckets[index] += 1;
  }

  return buckets;
}

export function DashboardOverviewPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<Period>("today");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchConversations(token), fetchOrders(token)])
      .then(([convRes, orderRes]) => {
        setConversations(convRes.conversations);
        setOrders(orderRes.orders);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  const periodStart = startOfPeriod(period);
  const filteredConversations = conversations.filter(
    (c) => new Date(c.createdAt) >= periodStart
  );
  const filteredOrders = orders.filter((o) => new Date(o.createdAt) >= periodStart);

  const totalValue = filteredOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const avgValue = filteredOrders.length ? totalValue / filteredOrders.length : 0;
  const spanish = filteredConversations.filter(
    (c) => (c.language ?? "").toLowerCase() === "spanish"
  ).length;
  const english = filteredConversations.filter(
    (c) => (c.language ?? "").toLowerCase() === "english"
  ).length;

  const chartValues = useMemo(
    () => dailyConversationCounts(conversations, period),
    [conversations, period]
  );
  const { line, area } = chartPath(chartValues.length ? chartValues : [0]);

  const recent = [...filteredConversations]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 8);

  return (
    <>
      <header className="page-header">
        <h1>Dashboard Overview</h1>
        <p>Monitor your voice agent’s performance at Amanit Sitges, Barcelona</p>
      </header>
      <div className="toolbar" aria-label="Period">
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      <div className="content-pad">
        {error ? <p className="form-error">{error}</p> : null}
        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <div>
                <p className="stat-label">Total Conversations</p>
                <p className="stat-value">{filteredConversations.length}</p>
              </div>
              <div className="stat-icon">
                <img src="/assets/icon-chat.svg" alt="" width={20} height={20} />
              </div>
            </div>
            <div className="stat-foot">
              <span>
                Spanish: {spanish} • English: {english}
              </span>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-top">
              <div>
                <p className="stat-label">Total Order</p>
                <p className="stat-value">{filteredOrders.length}</p>
              </div>
              <div className="stat-icon">
                <img src="/assets/icon-bag.svg" alt="" width={20} height={20} />
              </div>
            </div>
            <div className="stat-foot">
              <span>From voice agent</span>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-top">
              <div>
                <p className="stat-label">Total Order Value</p>
                <p className="stat-value">{formatMoney(totalValue)}</p>
              </div>
              <div className="stat-icon">
                <img src="/assets/icon-euro.svg" alt="" width={20} height={20} />
              </div>
            </div>
            <div className="stat-foot">
              <span>
                {filteredOrders.length
                  ? `Avg: ${formatMoney(avgValue)} per order`
                  : "No orders yet"}
              </span>
            </div>
          </article>
        </div>

        <section className="panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h2>Performance Overview</h2>
              <p className="sub">
                {period === "today"
                  ? "Conversations today."
                  : period === "week"
                    ? "Daily conversations for the past 7 days."
                    : "Daily conversations for this month."}
              </p>
            </div>
          </div>
          <div className="chart-wrap" aria-hidden="true">
            <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#26837d" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#26837d" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={area} fill="url(#areaFill)" />
              <polyline
                points={line}
                fill="none"
                stroke="#26837d"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </section>

        <section className="panel-card">
          <h2>Recent Activity</h2>
          <p className="sub">Latest conversations and orders from your voice agent.</p>
          <ul className="activity-list">
            {recent.map((conversation) => {
              const order = conversation.orders?.[0];
              const dropped = !order || conversation.status === "dropped";
              return (
                <li key={conversation.id} className="activity-item">
                  <div className={dropped ? "activity-icon dropped" : "activity-icon"}>
                    <img
                      src={dropped ? "/assets/icon-trend.svg" : "/assets/icon-bag.svg"}
                      alt=""
                      width={18}
                      height={18}
                    />
                  </div>
                  <div>
                    <div className="item-title">
                      <span>{conversation.tableLabel ?? conversation.callerName ?? "Guest"}</span>
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
                    </div>
                    <p className="item-summary">{conversation.summary ?? "No summary"}</p>
                  </div>
                  <div className="item-meta">
                    <span>{relativeTime(conversation.createdAt)}</span>
                    {order ? <strong>{formatMoney(order.totalCents)}</strong> : null}
                  </div>
                </li>
              );
            })}
            {!recent.length ? (
              <li className="empty">No conversations yet. They will appear after voice calls.</li>
            ) : null}
          </ul>
          <p style={{ marginTop: "1rem" }}>
            <Link className="order-link" to="/dashboard/conversations">
              View all conversations →
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
