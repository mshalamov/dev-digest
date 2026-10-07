import type { Severity } from "@devdigest/shared";

/** Finding severity helpers shared by the PR page (pills + filter) and the PR
 *  list (FINDINGS column). Pure grouping of findings already loaded: no fetch,
 *  no LLM call. */

/** Most severe first: the display order for pills, filters and icon counts. */
export const SEVERITIES: readonly Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

export type SeverityCounts = Record<Severity, number>;

/** True for the three levels the UI knows; anything else is bad data. */
export function isSeverity(s: string): s is Severity {
  return (SEVERITIES as readonly string[]).includes(s);
}

/** Count per severity. Unknown strings (the DB column is free text) are ignored. */
export function countBySeverity(items: readonly { severity: string }[]): SeverityCounts {
  const counts: SeverityCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const item of items) if (isSeverity(item.severity)) counts[item.severity] += 1;
  return counts;
}

/** Keep only one severity; `null` keeps everything (always a new array). */
export function filterBySeverity<T extends { severity: string }>(
  items: readonly T[],
  severity: Severity | null,
): T[] {
  return severity == null ? [...items] : items.filter((i) => i.severity === severity);
}

/** Click on a severity: select it, switch to it, or clear when it is already active. */
export function toggleSeverity(current: Severity | null, clicked: Severity): Severity | null {
  return current === clicked ? null : clicked;
}
