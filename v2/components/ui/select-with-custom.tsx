"use client";

import { useState } from "react";
import { inputCls } from "./entity-drawer";

// Hybrid picker: shows a <select> for known options + a "+ Other..." option
// that switches to a text input. Lets users discover what already exists
// (unlike a datalist) while still allowing free-text entries.
//
// Used across all entity forms wherever a category-style field needs both
// curated suggestions AND a way to type something new.

export function SelectWithCustom({
  value,
  onChange,
  options,
  placeholder = "Type a new value…",
  newLabel = "+ Other (type new)…",
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder?: string;
  newLabel?: string;
}) {
  // If value isn't in options (and isn't empty), force custom mode
  const valueIsKnown = value === "" || options.includes(value);
  const [custom, setCustom] = useState(!valueIsKnown);

  if (custom) {
    return (
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} flex-1`}
          autoFocus
        />
        <button
          type="button"
          onClick={() => { setCustom(false); onChange(options[0] ?? ""); }}
          className="rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted"
          title="Switch back to picker"
        >
          ↺
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setCustom(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={inputCls}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      <option value="__new__" className="font-semibold text-primary">{newLabel}</option>
    </select>
  );
}
