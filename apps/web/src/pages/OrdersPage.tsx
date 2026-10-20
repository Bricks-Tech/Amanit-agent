import { useEffect, useMemo, useState } from "react";
import { fetchOrders, type Order } from "../api";
import { useAuth } from "../auth";
import { OrderItemDetailsModal } from "../components/OrderItemDetailsModal";
import {
  formatDateShort,
  formatMoney,
  formatTableLabel,
  formatTime,
  itemCount,
} from "../lib/format";

type DateRange = "all" | "today" | "7d" | "30d";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function languageIcon(language?: string | null) {
  const key = (language ?? "").toLowerCase();
  if (key.includes("en")) return "/assets/icon-mic-en.svg";
  if (key.includes("es") || key.includes("span")) return "/assets/icon-mic-es.svg";
  return "/assets/icon-mic-es.svg";
}

function displayLanguage(language?: string | null) {
  if (!language) return "—";
  const key = language.toLowerCase();
  if (key === "es" || key.includes("span")) return "Spanish";
  if (key === "en" || key.includes("eng")) return "English";
  return language;
}

function conversationLabel(order: Order) {
  const id = order.conversation?.externalId;
  if (!id) return "—";
  // Short numeric-looking ids stay as-is; long conv_ ids truncate
  if (id.length > 12) return `#${id.slice(-6)}`;
  return `#${id}`;
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadOrdersCsv(rows: Order[]) {
  const header = [
    "Order ID",
    "Table",
    "Conversation",
    "Language",
    "Total (EUR)",
    "Items",
    "Time",
    "Date",
    "Notes",
    "Status",
  ];

  const lines = rows.map((order) => {
    const count = itemCount(order.items);
    return [
      order.externalId ?? order.id,
      formatTableLabel(order.tableLabel, order.customerName),
      order.conversation?.externalId ?? "",
      displayLanguage(order.language),
      (order.totalCents / 100).toFixed(2),
      String(count),
      formatTime(order.createdAt),
      formatDateShort(order.createdAt),
      order.notes ?? "",
      order.status,
    ]
      .map((cell) => csvEscape(cell))
      .join(",");
  });

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `amanit-orders-${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [language, setLanguage] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [minEuros, setMinEuros] = useState("0");
  const [maxEuros, setMaxEuros] = useState("999.99");
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchOrders(token)
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  const filtered = useMemo(() => {
    const minCents = Math.max(0, Math.round(Number(minEuros || 0) * 100));
    const maxCents = Math.max(0, Math.round(Number(maxEuros || 999.99) * 100));
    const now = new Date();
    const todayStart = startOfDay(now).getTime();

    return orders.filter((order) => {
      const haystack = [
        order.externalId,
        order.tableLabel,
        order.customerName,
        order.conversation?.externalId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());

      const lang = (order.language ?? "").toLowerCase();
      const matchesLanguage =
        language === "all" ||
        (language === "spanish" && (lang.includes("span") || lang === "es")) ||
        (language === "english" && (lang.includes("eng") || lang === "en"));

      const created = new Date(order.createdAt).getTime();
      let matchesDate = true;
      if (dateRange === "today") matchesDate = created >= todayStart;
      if (dateRange === "7d") matchesDate = created >= now.getTime() - 7 * 86400000;
      if (dateRange === "30d") matchesDate = created >= now.getTime() - 30 * 86400000;

      const matchesValue =
        order.totalCents >= minCents && order.totalCents <= maxCents;

      return matchesQuery && matchesLanguage && matchesDate && matchesValue;
    });
  }, [orders, query, language, dateRange, minEuros, maxEuros]);

  function clearFilters() {
    setLanguage("all");
    setDateRange("all");
    setMinEuros("0");
    setMaxEuros("999.99");
  }

  return (
    <>
      <header className="page-header">
        <h1>Orders</h1>
        <p>Track and manage all orders placed by your voice agent</p>
      </header>

      <div className="toolbar orders-toolbar">
        <div className="orders-search">
          <img src="/assets/icon-search.svg" alt="" width={16} height={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders…"
            aria-label="Search orders"
          />
        </div>
        <button
          type="button"
          className={`filter-btn${filtersOpen ? " filter-btn--accent" : ""}`}
          aria-expanded={filtersOpen}
          aria-controls="orders-filters-panel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <img src="/assets/icon-filter.svg" alt="" width={16} height={16} />
          Filter
        </button>
        <button
          type="button"
          className="filter-btn"
          onClick={() => downloadOrdersCsv(filtered)}
        >
          <img src="/assets/icon-export.svg" alt="" width={16} height={16} />
          Export
        </button>
      </div>

      {filtersOpen ? (
        <div className="orders-filters" id="orders-filters-panel">
          <label className="orders-filter-field">
            <span>Language</span>
            <div className="orders-select-wrap">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="all">All Languages</option>
                <option value="spanish">Spanish only</option>
                <option value="english">English only</option>
              </select>
              <img src="/assets/icon-chevron.svg" alt="" width={16} height={16} />
            </div>
          </label>
          <label className="orders-filter-field">
            <span>Date Range</span>
            <div className="orders-select-wrap">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              <img src="/assets/icon-chevron.svg" alt="" width={16} height={16} />
            </div>
          </label>
          <label className="orders-filter-field">
            <span>Min Value</span>
            <div className="orders-value-input">
              <span aria-hidden="true">€</span>
              <input
                inputMode="decimal"
                value={minEuros}
                onChange={(e) => setMinEuros(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </label>
          <label className="orders-filter-field">
            <span>Max Value</span>
            <div className="orders-value-input">
              <span aria-hidden="true">€</span>
              <input
                inputMode="decimal"
                value={maxEuros}
                onChange={(e) => setMaxEuros(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </label>
          <button type="button" className="orders-clear-btn" onClick={clearFilters}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="content-pad orders-content">
        {error ? <p className="form-error">{error}</p> : null}
        <section className="panel-card orders-panel">
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Table</th>
                  <th>Conversation</th>
                  <th>Language</th>
                  <th>Total</th>
                  <th>Items</th>
                  <th>Time</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const count = itemCount(order.items);
                  const langLabel = displayLanguage(order.language);
                  return (
                    <tr key={order.id}>
                      <td>
                        <button
                          type="button"
                          className="order-link"
                          onClick={() => setSelectedOrder(order)}
                        >
                          #{order.externalId ?? order.id.slice(0, 6)}
                        </button>
                      </td>
                      <td className="orders-cell-ink">
                        {formatTableLabel(order.tableLabel, order.customerName)}
                      </td>
                      <td className="orders-cell-muted">{conversationLabel(order)}</td>
                      <td>
                        {langLabel === "—" ? (
                          "—"
                        ) : (
                          <span className="orders-lang">
                            <img
                              src={languageIcon(order.language)}
                              alt=""
                              width={16}
                              height={16}
                            />
                            {langLabel}
                          </span>
                        )}
                      </td>
                      <td className="orders-cell-total">{formatMoney(order.totalCents)}</td>
                      <td>
                        <button
                          type="button"
                          className="order-link"
                          onClick={() => setSelectedOrder(order)}
                        >
                          {count} {count === 1 ? "item" : "items"}
                        </button>
                      </td>
                      <td className="orders-cell-muted">{formatTime(order.createdAt)}</td>
                      <td className="orders-cell-muted">{formatDateShort(order.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length ? <p className="empty">No orders match.</p> : null}
          </div>
          <div className="pager">
            <span>
              Showing {filtered.length} of {orders.length} orders
            </span>
            <div className="pager-actions">
              <button type="button" className="page-btn" disabled>
                Previous
              </button>
              <button type="button" className="page-btn active">
                1
              </button>
              <button type="button" className="page-btn" disabled>
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {selectedOrder ? (
        <OrderItemDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      ) : null}
    </>
  );
}
