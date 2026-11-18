import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Order, OrderItem, OrderStatus } from "../api";
import { formatMoney } from "../lib/format";
import { isOrderStatus, ORDER_STATUSES, orderStatusLabel } from "../lib/orderStatus";

type Props = {
  order: Order;
  statusBusy?: boolean;
  statusError?: string | null;
  onClose: () => void;
  onStatusChange: (status: OrderStatus) => Promise<void> | void;
  onRequestReject: () => void;
};

function conversationHref(order: Order) {
  const conversationId = order.conversationId ?? order.conversation?.id;
  if (!conversationId) return null;
  return `/dashboard/orders/conversations/${conversationId}`;
}

function normalizeItems(items: Order["items"]): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    name: item.name || "Item",
    quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
    priceCents: Number.isFinite(item.priceCents) ? item.priceCents : 0,
  }));
}

/** Line total: stored priceCents is per-unit from create-order. */
function lineTotalCents(item: OrderItem) {
  return item.quantity * item.priceCents;
}

/** IVA 10% included in total (Spanish VAT style from Figma). */
function ivaIncludedCents(totalCents: number) {
  return Math.round((totalCents * 10) / 110);
}

function currentStatus(order: Order): OrderStatus {
  return isOrderStatus(order.status) ? order.status : "PENDING";
}

export function OrderItemDetailsModal({
  order,
  statusBusy = false,
  statusError = null,
  onClose,
  onStatusChange,
  onRequestReject,
}: Props) {
  const items = normalizeItems(order.items);
  const subtotalCents =
    order.totalCents || items.reduce((sum, item) => sum + lineTotalCents(item), 0);
  const ivaCents = ivaIncludedCents(subtotalCents);
  const orderLabel = `#${order.externalId ?? order.id.slice(0, 6)}`;
  const conversationPath = conversationHref(order);
  const savedStatus = currentStatus(order);

  const [draftStatus, setDraftStatus] = useState<OrderStatus>(savedStatus);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDraftStatus(savedStatus);
    setLocalError(null);
  }, [order.id, savedStatus]);

  async function handleStatusSelect(next: OrderStatus) {
    setLocalError(null);
    if (next === "REJECTED") {
      setDraftStatus(savedStatus);
      onRequestReject();
      return;
    }
    setDraftStatus(next);
    try {
      await onStatusChange(next);
    } catch (err) {
      setDraftStatus(savedStatus);
      setLocalError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div
      className="item-details-overlay"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="item-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="item-details-header item-details-header--with-status">
          <div className="item-details-heading">
            <h2 id="item-details-title">Item Details</h2>
            <p className="item-details-order-id">{orderLabel}</p>
          </div>
          <div className={`orders-status-pill orders-status-pill--${draftStatus.toLowerCase()}`}>
            <select
              className="orders-status-select"
              value={draftStatus}
              disabled={statusBusy}
              aria-label="Order status"
              onChange={(e) => {
                const value = e.target.value;
                if (isOrderStatus(value)) void handleStatusSelect(value);
              }}
            >
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="item-details-body">
          {localError || statusError ? (
            <p className="form-error">{localError ?? statusError}</p>
          ) : null}

          {savedStatus === "REJECTED" && order.reason?.trim() ? (
            <div className="item-details-reject-reason">
              <div className="item-details-reject-reason-head">
                <p className="item-details-reject-reason-label">Reason</p>
                <button
                  type="button"
                  className="item-details-reject-reason-edit"
                  aria-label="Edit reason"
                  disabled={statusBusy}
                  onClick={onRequestReject}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M11.333 2.333a1.414 1.414 0 0 1 2 2L5.5 12.167 2.667 13l.833-2.833L11.333 2.333Z"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="item-details-reject-reason-box">{order.reason.trim()}</div>
            </div>
          ) : null}

          <ul className="item-details-list">
            {items.length ? (
              items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="item-details-row">
                  <div className="item-details-meta">
                    <span className="item-details-name">{item.name}</span>
                    <span className="item-details-qty">Qty: {item.quantity}</span>
                  </div>
                  <span className="item-details-price">{formatMoney(lineTotalCents(item))}</span>
                </li>
              ))
            ) : (
              <li className="item-details-empty">No items on this order.</li>
            )}
          </ul>

          <div className="item-details-totals">
            <div className="item-details-total-row">
              <span>Subtotal</span>
              <span className="item-details-total-value">{formatMoney(subtotalCents)}</span>
            </div>
            <div className="item-details-total-row item-details-total-row--iva">
              <span>IVA (10%, included)</span>
              <span className="item-details-total-value">{formatMoney(ivaCents)}</span>
            </div>
            <div className="item-details-total-row item-details-total-row--grand">
              <span>Total</span>
              <span className="item-details-grand-total">{formatMoney(subtotalCents)}</span>
            </div>
          </div>

          <div className="item-details-notes">
            <p className="item-details-notes-label">Extra Notes</p>
            <div className="item-details-notes-box">
              {order.notes?.trim() ? order.notes : "No extra notes."}
            </div>
          </div>
        </div>

        <footer className="item-details-footer">
          {conversationPath ? (
            <Link className="item-details-conversation" to={conversationPath} onClick={onClose}>
              View Conversation
              <img src="/assets/conv-arrow-teal.svg" alt="" width={16} height={16} />
            </Link>
          ) : null}
          <button type="button" className="item-details-close" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
