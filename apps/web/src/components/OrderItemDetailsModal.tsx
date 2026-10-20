import type { Order, OrderItem } from "../api";
import { formatMoney } from "../lib/format";

type Props = {
  order: Order;
  onClose: () => void;
};

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

export function OrderItemDetailsModal({ order, onClose }: Props) {
  const items = normalizeItems(order.items);
  const subtotalCents =
    order.totalCents || items.reduce((sum, item) => sum + lineTotalCents(item), 0);
  const ivaCents = ivaIncludedCents(subtotalCents);
  const orderLabel = `#${order.externalId ?? order.id.slice(0, 6)}`;

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
        <header className="item-details-header">
          <h2 id="item-details-title">Item Details</h2>
          <p className="item-details-order-id">{orderLabel}</p>
        </header>

        <div className="item-details-body">
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
          <button type="button" className="item-details-close" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
