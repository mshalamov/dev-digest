import type { FindingRecord, Severity } from "@devdigest/shared";
import { filterBySeverity } from "@/lib/severity";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Optionally keep one severity, drop low-confidence findings, and sort by
 *  severity, then confidence (highest first), the same order as the PR-list popover. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: Severity | null = null,
): FindingRecord[] {
  let shown = filterBySeverity(findings, severity);
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  return shown.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
      b.confidence - a.confidence,
  );
}
