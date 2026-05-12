"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Right-anchored slide-over drawer with backdrop. Used for entity add/edit forms.
// ESC closes; clicking backdrop closes. Form lives in `children`, action buttons
// in `footer` (split so the footer doesn't scroll with the body).

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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col",
          "border-l border-border bg-card shadow-2xl",
          "animate-in slide-in-from-right duration-200"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        <footer className="border-t border-border bg-muted/30 px-5 py-3">{footer}</footer>
      </div>
    </>
  );
}

// Small confirm-delete prompt rendered inline (no extra modal). Use inside an
// EntityDrawer's body or as a controlled section the form toggles to.
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
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 dark:bg-rose-950/30">
      <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
        Delete {label}?
      </p>
      <p className="mt-0.5 text-xs text-rose-600/80 dark:text-rose-400/80">
        This cannot be undone.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// Standard form field wrapper for consistent labels + spacing across forms.
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
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
