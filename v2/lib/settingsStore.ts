"use client";

import { useState, useEffect, useCallback } from "react";

export type AppSettings = {
  workingDays: number[];        // 0=Sun … 6=Sat; default Mon-Fri
  holidays: string[];           // ISO date strings, sorted
  ragThresholds: {
    redDelayDays: number;       // default 5
    amberDelayDays: number;     // default 0
  };
  budgetBands: {
    redPct: number;             // default 85
    amberPct: number;           // default 60
  };
};

const STORAGE_KEY = "aivello_settings_v1";

export const DEFAULT_SETTINGS: AppSettings = {
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
  ragThresholds: { redDelayDays: 5, amberDelayDays: 0 },
  budgetBands: { redPct: 85, amberPct: 60 },
};

function load(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setSettingsState(load());
  }, []);

  const setSettings = useCallback((updater: (prev: AppSettings) => AppSettings) => {
    setSettingsState((prev) => {
      const next = updater(prev);
      save(next);
      return next;
    });
  }, []);

  function setWorkingDays(days: number[]) {
    const unique = Array.from(new Set(days)).sort((a, b) => a - b);
    setSettings((s) => ({ ...s, workingDays: unique }));
  }

  function addHoliday(iso: string): "added" | "duplicate" | "invalid" {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "invalid";
    let result: "added" | "duplicate" = "duplicate";
    setSettings((s) => {
      if (s.holidays.includes(iso)) return s;
      result = "added";
      return { ...s, holidays: [...s.holidays, iso].sort() };
    });
    return result;
  }

  function removeHoliday(iso: string) {
    setSettings((s) => ({ ...s, holidays: s.holidays.filter((h) => h !== iso) }));
  }

  function bulkAddHolidays(isos: string[]): number {
    let added = 0;
    setSettings((s) => {
      const existing = new Set(s.holidays);
      const valid = isos.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !existing.has(d));
      added = valid.length;
      return { ...s, holidays: [...s.holidays, ...valid].sort() };
    });
    return added;
  }

  function setRagThresholds(t: Partial<AppSettings["ragThresholds"]>) {
    setSettings((s) => ({ ...s, ragThresholds: { ...s.ragThresholds, ...t } }));
  }

  function setBudgetBands(b: Partial<AppSettings["budgetBands"]>) {
    setSettings((s) => ({ ...s, budgetBands: { ...s.budgetBands, ...b } }));
  }

  function resetToDefaults() {
    setSettings(() => DEFAULT_SETTINGS);
  }

  return {
    settings,
    setWorkingDays,
    addHoliday,
    removeHoliday,
    bulkAddHolidays,
    setRagThresholds,
    setBudgetBands,
    resetToDefaults,
  };
}
