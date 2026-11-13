import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrders, updateOrderStatus, type Order, type OrderStatus } from "../api";
import { useAuth } from "../auth";
import { MenuSelect } from "../components/MenuSelect";
import { OrderItemDetailsModal } from "../components/OrderItemDetailsModal";
import { RejectReasonModal } from "../components/RejectReasonModal";
import {
  formatDateShort,
  formatMoney,
  formatTableLabel,
  formatTime,
  itemCount,
} from "../lib/format";
import { isOrderStatus, ORDER_STATUSES, orderStatusLabel } from "../lib/orderStatus";

type DateRange = "all" | "today" | "7d" | "30d";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function languageIcon(language?: string | null) {
  const key = (language ?? "").trim().toLowerCase();
  if (key === "en" || key.startsWith("en-") || key.includes("english")) return "/assets/icon-mic-en.svg";
  return "/assets/icon-mic-es.svg";
}

function displayLanguage(language?: string | null) {
  if (!language?.trim()) return "—";
  const key = language.trim().toLowerCase();
  if (key === "es" || key.startsWith("es-") || key.includes("span")) return "Spanish";
  if (key === "en" || key.startsWith("en-") || key.includes("english")) return "English";
  return language;
}

function orderLanguage(order: Order) {
  return order.language || order.conversation?.language;
}

function conversationLabel(order: Order) {
  const id = order.conversation?.externalId;
  if (!id) return "—";
  // Short numeric-looking ids stay as-is; long conv_ ids truncate
  if (id.length > 12) return `#${id.slice(-6)}`;
  return `#${id}`;
}

function orderConversationId(order: Order) {
  return order.conversationId ?? order.conversation?.id ?? null;
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
    "Reason",
  ];

  const lines = rows.map((order) => {
    const count = itemCount(order.items);
    return [
      order.externalId ?? order.id,
      formatTableLabel(order.tableLabel, order.customerName),
      order.conversation?.externalId ?? "",
      displayLanguage(orderLanguage(order)),
      (order.totalCents / 100).toFixed(2),
      String(count),
      formatTime(order.createdAt),
      formatDateShort(order.createdAt),
      order.notes ?? "",
      isOrderStatus(order.status) ? orderStatusLabel(order.status) : order.status,
      order.status === "REJECTED" ? order.reason ?? "" : "",
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
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [minEuros, setMinEuros] = useState("0");
  const [maxEuros, setMaxEuros] = useState("999.99");
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchOrders(token)
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  function applyUpdatedOrder(updated: Order) {
    setOrders((prev) => prev.map((order) => (order.id === updated.id ? { ...order, ...updated } : order)));
    setSelectedOrder((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    setRejectTarget((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }

  async function persistStatus(order: Order, status: OrderStatus, reason?: string) {
    if (!token) return;
    setStatusBusyId(order.id);
    setStatusError(null);
    try {
      const res = await updateOrderStatus(token, order.id, status, reason);
      applyUpdatedOrder(res.order);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setStatusError(message);
      throw err;
    } finally {
      setStatusBusyId(null);
    }
  }

  async function handleTableStatusChange(order: Order, next: OrderStatus) {
    if (next === order.status) return;
    if (next === "REJECTED") {
      setRejectTarget(order);
      return;
    }
    try {
      await persistStatus(order, next);
    } catch {
      // error surfaced via statusError
    }
  }

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

      const lang = (orderLanguage(order) ?? "").trim().toLowerCase();
      const matchesLanguage =
        language === "all" ||
        (language === "spanish" && (lang.includes("span") || lang === "es" || lang.startsWith("es-"))) ||
        (language === "english" && (lang.includes("english") || lang === "en" || lang.startsWith("en-")));

      const created = new Date(order.createdAt).getTime();
      let matchesDate = true;
      if (dateRange === "today") matchesDate = created >= todayStart;
      if (dateRange === "7d") matchesDate = created >= now.getTime() - 7 * 86400000;
      if (dateRange === "30d") matchesDate = created >= now.getTime() - 30 * 86400000;

      const matchesValue =
        order.totalCents >= minCents && order.totalCents <= maxCents;

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      return matchesQuery && matchesLanguage && matchesDate && matchesValue && matchesStatus;
    });
  }, [orders, query, language, statusFilter, dateRange, minEuros, maxEuros]);

  function clearFilters() {
    setLanguage("all");
    setStatusFilter("all");
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
          <div className="orders-filter-field">
            <span>Language</span>
            <MenuSelect
              className="orders-menu-select"
              triggerClassName="orders-select-wrap"
              ariaLabel="Filter by language"
              value={language}
              onChange={setLanguage}
              options={[
                { value: "all", label: "All Languages" },
                { value: "spanish", label: "Spanish only" },
                { value: "english", label: "English only" },
              ]}
            />
          </div>
          <div className="orders-filter-field">
            <span>Status</span>
            <MenuSelect
              className="orders-menu-select"
              triggerClassName="orders-select-wrap"
              ariaLabel="Filter by status"
              value={statusFilter}
              onChange={(value) => {
                if (value === "all" || isOrderStatus(value)) setStatusFilter(value);
              }}
              options={[
                { value: "all", label: "All Statuses" },
                ...ORDER_STATUSES.map((status) => ({
                  value: status,
                  label: orderStatusLabel(status),
                })),
              ]}
            />
          </div>
          <div className="orders-filter-field">
            <span>Date Range</span>
            <MenuSelect
              className="orders-menu-select"
              triggerClassName="orders-select-wrap"
              ariaLabel="Filter by date range"
              value={dateRange}
              onChange={(value) => setDateRange(value as DateRange)}
              options={[
                { value: "all", label: "All Time" },
                { value: "today", label: "Today" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
              ]}
            />
          </div>
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const count = itemCount(order.items);
                  const language = orderLanguage(order);
                  const langLabel = displayLanguage(language);
                  const conversationId = orderConversationId(order);
                  const conversationText = conversationLabel(order);
                  const statusValue = isOrderStatus(order.status) ? order.status : "PENDING";
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
                      <td className="orders-cell-muted">
                        {conversationId && conversationText !== "—" ? (
                          <Link
                            className="order-link"
                            to={`/dashboard/orders/conversations/${conversationId}`}
                          >
                            {conversationText}
                          </Link>
                        ) : (
                          conversationText
                        )}
                      </td>
                      <td>
                        {langLabel === "—" ? (
                          "—"
                        ) : (
                          <span className="orders-lang">
                            <img
                              src={languageIcon(language)}
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
                      <td>
                        <div
                          className={`orders-status-pill orders-status-pill--${statusValue.toLowerCase()}`}
                        >
                          <select
                            className="orders-status-select"
                            value={statusValue}
                            disabled={statusBusyId === order.id}
                            aria-label={`Status for order ${order.externalId ?? order.id.slice(0, 6)}`}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (isOrderStatus(value)) void handleTableStatusChange(order, value);
                            }}
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {orderStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
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
          statusBusy={statusBusyId === selectedOrder.id}
          statusError={statusError}
          onClose={() => {
            setSelectedOrder(null);
            setStatusError(null);
          }}
          onStatusChange={async (status) => {
            await persistStatus(selectedOrder, status);
          }}
          onRequestReject={() => {
            setStatusError(null);
            setRejectTarget(selectedOrder);
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectReasonModal
          orderLabel={`#${rejectTarget.externalId ?? rejectTarget.id.slice(0, 6)}`}
          initialReason={rejectTarget.reason}
          isEditing={rejectTarget.status === "REJECTED"}
          busy={statusBusyId === rejectTarget.id}
          error={statusError}
          onCancel={() => {
            setRejectTarget(null);
            setStatusError(null);
          }}
          onSubmit={(reason) => {
            void persistStatus(rejectTarget, "REJECTED", reason)
              .then(() => {
                setRejectTarget(null);
                setStatusError(null);
              })
              .catch(() => {
                // keep modal open; error shown via statusError
              });
          }}
        />
      ) : null}
    </>
  );
}
