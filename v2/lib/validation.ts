// Shared form-side validation helpers. Forms use these to decide between
// hard-block (return error) and soft-warn (Sonner toast.warning) outcomes.

export const PROJECT_DATE_MIN = "2024-01-01";
export const PROJECT_DATE_MAX = "2030-12-31";

/** Empty string is treated as "not set" and returns true (forms enforce required separately). */
export function isIsoDate(s: string): boolean {
  return s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** True if date is between PROJECT_DATE_MIN and PROJECT_DATE_MAX (inclusive). Empty string passes. */
export function inProjectRange(s: string): boolean {
  if (!s) return true;
  return s >= PROJECT_DATE_MIN && s <= PROJECT_DATE_MAX;
}

/** -1 / 0 / 1 comparator for ISO date strings. */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Add N calendar days to an ISO date and return ISO. Used for auto-suggest. */
export function addCalendarDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
