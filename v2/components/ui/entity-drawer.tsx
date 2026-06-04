"use client";

// Right-anchored slide-over drawer with backdrop. Shared chrome for all
// entity add/edit forms (task, milestone, charter, issue, decision, risk,
// cost-line, document, meeting, team-member — 10 consumers).
//
// M26.1.1 — refactored to the AivelloStudio design system. All styling
// comes from .drawer-* / .field-* / .field-input classes in components.css.
// ESC closes; clicking backdrop closes. Form lives in `children`, action
// buttons in `footer` (split so the footer doesn't scroll with the body).

import { useEffect } from "react";
import { X } from "lucide-react";

export function EntityDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll behind drawer
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />

      <div className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="drawer-header__title">{title}</h2>
            {subtitle && <p className="drawer-header__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X width={14} height={14} />
          </button>
        </header>

        <div className="drawer-body">{children}</div>

        <footer className="drawer-footer">{footer}</footer>
      </div>
    </>
  );
}

// Inline confirm-delete prompt. Rendered inside an EntityDrawer's footer
// or as a controlled section the form toggles to. Token-styled with the
// risk tone — never a separate modal.
export function ConfirmDelete({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-delete">
      <p className="confirm-delete__title">Delete {label}?</p>
      <p className="confirm-delete__hint">This cannot be undone.</p>
      <div className="confirm-delete__actions">
        <button type="button" onClick={onCancel} className="btn btn--ghost">Cancel</button>
        <button type="button" onClick={onConfirm} className="btn btn--danger">Delete</button>
      </div>
    </div>
  );
}

// Standard form field wrapper for consistent labels + spacing across all
// drawers. Uses .field / .field-label / .field-hint design-token classes.
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="field-required">*</span>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// Shared input class string applied to inputs, textareas, and selects
// across all forms. Maps to .field-input in components.css — token-driven,
// 32px min-height matching .btn, design-token focus ring.
export const inputCls = "field-input";
