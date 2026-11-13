import { useState } from "react";

type Props = {
  orderLabel: string;
  initialReason?: string | null;
  isEditing?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export function RejectReasonModal({
  orderLabel,
  initialReason,
  isEditing = false,
  busy = false,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState(initialReason?.trim() ?? "");

  return (
    <div
      className="item-details-overlay reject-reason-overlay"
      role="presentation"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div
        className="item-details-modal reject-reason-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-reason-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="item-details-header">
          <h2 id="reject-reason-title">{isEditing ? "Edit reason" : "Reject order"}</h2>
          <p className="item-details-order-id">{orderLabel}</p>
        </header>

        <div className="item-details-body">
          <label className="reject-reason-field">
            <span>Reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this order being rejected?"
              rows={4}
              autoFocus
              disabled={busy}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
        </div>

        <footer className="item-details-footer reject-reason-footer">
          <button type="button" className="reject-reason-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="reject-reason-submit"
            disabled={busy || !reason.trim()}
            onClick={() => onSubmit(reason.trim())}
          >
            {busy ? "Saving…" : isEditing ? "Save reason" : "Reject order"}
          </button>
        </footer>
      </div>
    </div>
  );
}
