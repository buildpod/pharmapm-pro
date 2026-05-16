// Port of src/domain/dates.js — pure date utilities operating in UTC with ISO-8601 strings.
// All DST-safety comes from operating on UTC date components, never local time.

interface ParsedDate {
  y: number;
  m: number;
  d: number;
}

function parseISO(iso: string): ParsedDate | null {
  if (!iso || typeof iso !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function formatISO(p: ParsedDate): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function toUTCDate(p: ParsedDate): Date {
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

function fromUTCDate(d: Date): ParsedDate {
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

export function isValidISO(iso: string): boolean {
  const p = parseISO(iso);
  if (!p) return false;
  const dt = toUTCDate(p);
  // Guards against e.g. 2026-02-31 which normalizes to March
  return (
    dt.getUTCFullYear() === p.y &&
    dt.getUTCMonth() + 1 === p.m &&
    dt.getUTCDate() === p.d
  );
}

export function dayOfWeek(iso: string): number {
  const p = parseISO(iso);
  if (!p) return -1;
  return toUTCDate(p).getUTCDay();
}

export function today(): string {
  const d = new Date();
  return formatISO({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(iso: string, days: number): string | null {
  const p = parseISO(iso);
  if (!p) return null;
  const dt = toUTCDate(p);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatISO(fromUTCDate(dt));
}

export function addWorkingDays(
  iso: string,
  days: number,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): string | null {
  if (!days) return iso;
  let current = iso;
  const step = days > 0 ? 1 : -1;
  const target = Math.abs(days);
  let moved = 0;
  let guard = 0;
  while (moved < target) {
    const next = addDays(current, step);
    if (!next) return null;
    current = next;
    guard++;
    if (guard > 10000) return null;
    if (workingDays.indexOf(dayOfWeek(current)) >= 0 && !holidays.includes(current)) {
      moved++;
    }
  }
  return current;
}

export function daysBetween(a: string, b: string): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  if (!pa || !pb) return 0;
  const ms = toUTCDate(pb).getTime() - toUTCDate(pa).getTime();
  return Math.round(ms / 86_400_000);
}

// M20.5 PL-3 — working-day distance between two ISO dates.
// Positive if b >= a, negative if b < a. Skips weekends + holidays. Counts
// the number of working-day steps required to walk from a to b, exclusive
// of the start. Used for shift-display semantics in the cascade impact drawer
// (so a "+7 calendar days" weekend shift reads as "+5 working days" to PMs).
export function workingDaysBetween(
  a: string,
  b: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): number {
  if (!a || !b) return 0;
  const cmp = compare(a, b);
  if (cmp === 0) return 0;
  const forward = cmp < 0;
  let cursor = a;
  let count = 0;
  let guard = 0;
  while (compare(cursor, b) !== 0 && guard < 10_000) {
    const next = addDays(cursor, forward ? 1 : -1);
    if (!next) break;
    cursor = next;
    guard++;
    if (workingDays.indexOf(dayOfWeek(cursor)) >= 0 && !holidays.includes(cursor)) {
      count++;
    }
  }
  return forward ? count : -count;
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const pa = parseISO(a);
  const pb = parseISO(b);
  if (!pa || !pb) return 0;
  const ta = toUTCDate(pa).getTime();
  const tb = toUTCDate(pb).getTime();
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}
