"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Plus, RotateCcw, Calendar } from "lucide-react";
import { useSettings } from "@/lib/settingsStore";
import { getCountries, getHolidays } from "@/lib/domain/countryHolidays";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
];

const COUNTRIES = getCountries();

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Input style ──────────────────────────────────────────────────────────────

const inputCls = "rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsPanel() {
  const {
    settings,
    setWorkingDays,
    addHoliday,
    removeHoliday,
    bulkAddHolidays,
    setRagThresholds,
    setBudgetBands,
    resetToDefaults,
  } = useSettings();

  // Working days state
  const [selectedDays, setSelectedDays] = useState<number[]>(settings.workingDays);

  // Country preset state
  const [countryCode, setCountryCode] = useState("US");
  const [year, setYear]               = useState<"2026" | "2027" | "both">("2026");

  // Manual holiday state
  const [manualDate, setManualDate] = useState("");

  // RAG / budget local state (committed on blur)
  const [ragRed,   setRagRed]   = useState(String(settings.ragThresholds.redDelayDays));
  const [ragAmber, setRagAmber] = useState(String(settings.ragThresholds.amberDelayDays));
  const [budgRed,  setBudgRed]  = useState(String(settings.budgetBands.redPct));
  const [budgAmb,  setBudgAmb]  = useState(String(settings.budgetBands.amberPct));

  // ── Working days ────────────────────────────────────────────────────────────

  function toggleDay(day: number) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    if (next.length === 0) {
      toast.error("At least one working day is required.");
      return;
    }
    setSelectedDays(next);
    setWorkingDays(next);
    toast.success(`Working days updated — ${next.length} day${next.length !== 1 ? "s" : ""} selected.`);
  }

  // ── Country preset ──────────────────────────────────────────────────────────

  function applyPreset() {
    const isos = year === "both"
      ? getHolidays(countryCode)
      : getHolidays(countryCode, Number(year));
    const added = bulkAddHolidays(isos);
    const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name ?? countryCode;
    if (added === 0) {
      toast.info(`No new holidays to add for ${countryName} ${year === "both" ? "2026-2027" : year} — all already present.`);
    } else {
      toast.success(`Added ${added} holiday${added !== 1 ? "s" : ""} for ${countryName} (${year === "both" ? "2026-2027" : year}).`);
    }
  }

  // ── Manual holiday ──────────────────────────────────────────────────────────

  function handleAddManual() {
    const result = addHoliday(manualDate);
    if (result === "added") {
      toast.success(`Holiday added: ${manualDate}`);
      setManualDate("");
    } else if (result === "duplicate") {
      toast.info(`${manualDate} is already in the list.`);
    } else {
      toast.error("Invalid date — use YYYY-MM-DD format.");
    }
  }

  function handleRemoveHoliday(iso: string) {
    removeHoliday(iso);
    toast.success(`Removed holiday: ${iso}`);
  }

  // ── RAG thresholds ──────────────────────────────────────────────────────────

  function commitRag() {
    const red   = parseInt(ragRed,   10);
    const amber = parseInt(ragAmber, 10);
    if (isNaN(red) || isNaN(amber) || red < 0 || amber < 0 || amber >= red) {
      toast.error("RAG: Red threshold must be greater than Amber, both ≥ 0.");
      setRagRed(String(settings.ragThresholds.redDelayDays));
      setRagAmber(String(settings.ragThresholds.amberDelayDays));
      return;
    }
    setRagThresholds({ redDelayDays: red, amberDelayDays: amber });
    toast.success(`RAG thresholds updated — Amber >${amber}d, Red ≥${red}d.`);
  }

  // ── Budget bands ─────────────────────────────────────────────────────────────

  function commitBudget() {
    const red   = parseInt(budgRed, 10);
    const amber = parseInt(budgAmb, 10);
    if (isNaN(red) || isNaN(amber) || amber >= red || red > 100 || amber < 0) {
      toast.error("Budget bands: Amber % must be less than Red %, both between 0–100.");
      setBudgRed(String(settings.budgetBands.redPct));
      setBudgAmb(String(settings.budgetBands.amberPct));
      return;
    }
    setBudgetBands({ redPct: red, amberPct: amber });
    toast.success(`Budget burn bands updated — Amber >${amber}%, Red ≥${red}%.`);
  }

  // ── Reset ───────────────────────────────────────────────────────────────────

  function handleReset() {
    resetToDefaults();
    setSelectedDays([1, 2, 3, 4, 5]);
    setRagRed("5"); setRagAmber("0");
    setBudgRed("85"); setBudgAmb("60");
    setManualDate("");
    toast.success("All settings reset to defaults.");
  }

  return (
    <div className="space-y-4 max-w-2xl">

      {/* ── Working days ── */}
      <Section
        title="Working Days"
        description="Select which days of the week count as working days. Used for all date arithmetic — addWorkingDays, cascade, backward scheduling."
      >
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const active = selectedDays.includes(d.value);
            return (
              <button
                key={d.value}
                onClick={() => toggleDay(d.value)}
                title={d.label}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                )}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {selectedDays.length} day{selectedDays.length !== 1 ? "s" : ""} selected ·{" "}
          {DAYS.filter((d) => selectedDays.includes(d.value)).map((d) => d.short).join(", ")}
        </p>
      </Section>

      {/* ── Country holiday preset ── */}
      <Section
        title="Country Holiday Presets"
        description="Bulk-add national public holidays from 15 pharma-hub countries. Duplicates are skipped automatically."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Country</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className={inputCls}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value as typeof year)}
              className={inputCls}
            >
              <option value="2026">2026</option>
              <option value="2027">2027</option>
              <option value="both">2026 + 2027</option>
            </select>
          </div>
          <button
            onClick={applyPreset}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
            Apply preset
          </button>
        </div>

        {/* Current holidays list */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current holidays ({settings.holidays.length})
          </p>
          {settings.holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No holidays added yet.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {settings.holidays.map((iso) => (
                <div key={iso} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs tabular-nums text-foreground">{iso}</span>
                  <button
                    onClick={() => handleRemoveHoliday(iso)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual add */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Add single date</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className={cn(inputCls, "w-40")}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddManual(); }}
            />
            <button
              onClick={handleAddManual}
              disabled={!manualDate}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>
      </Section>

      {/* ── RAG thresholds ── */}
      <Section
        title="RAG Schedule Thresholds"
        description="Number of days a milestone is delayed before flipping status. Amber threshold must be lower than Red."
      >
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Amber — delayed more than (days)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={ragAmber}
                onChange={(e) => setRagAmber(e.target.value)}
                onBlur={commitRag}
                onKeyDown={(e) => { if (e.key === "Enter") commitRag(); }}
                className={cn(inputCls, "w-20")}
              />
              <span className="text-xs text-muted-foreground">days late → Amber</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Red — delayed ≥ (days)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={ragRed}
                onChange={(e) => setRagRed(e.target.value)}
                onBlur={commitRag}
                onKeyDown={(e) => { if (e.key === "Enter") commitRag(); }}
                className={cn(inputCls, "w-20")}
              />
              <span className="text-xs text-muted-foreground">days late → Red</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" /> Green: on-time or early</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Amber: &gt;{settings.ragThresholds.amberDelayDays}d late</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" /> Red: ≥{settings.ragThresholds.redDelayDays}d late</span>
        </div>
      </Section>

      {/* ── Budget burn bands ── */}
      <Section
        title="Budget Burn Bands"
        description="Percentage of budget spent that triggers Amber or Red on burn indicators."
      >
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Amber threshold (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={99}
                value={budgAmb}
                onChange={(e) => setBudgAmb(e.target.value)}
                onBlur={commitBudget}
                onKeyDown={(e) => { if (e.key === "Enter") commitBudget(); }}
                className={cn(inputCls, "w-20")}
              />
              <span className="text-xs text-muted-foreground">% spent → Amber</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Red threshold (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={budgRed}
                onChange={(e) => setBudgRed(e.target.value)}
                onBlur={commitBudget}
                onKeyDown={(e) => { if (e.key === "Enter") commitBudget(); }}
                className={cn(inputCls, "w-20")}
              />
              <span className="text-xs text-muted-foreground">% spent → Red</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" /> Green: ≤{settings.budgetBands.amberPct}%</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Amber: {settings.budgetBands.amberPct}–{settings.budgetBands.redPct - 1}%</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" /> Red: ≥{settings.budgetBands.redPct}%</span>
        </div>
      </Section>

      {/* ── Reset ── */}
      <div className="flex justify-end">
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
