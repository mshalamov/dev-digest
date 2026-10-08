import { Severity, type PrFindingCounts, type PrFindingPreview } from '@devdigest/shared';

/**
 * FINDINGS column on the PR list: a read-only preview of the findings of the
 * newest review of EACH agent on the PR. "Run all agents" writes one review per
 * agent, so taking only the newest review overall would hide one agent's
 * findings behind another's clean run. Pure so it is unit-testable without a
 * DB. The client counts per severity from this, so there is no extra fetch on
 * hover and no LLM call.
 */
export interface FindingPreviewRow {
  id: string;
  reviewId: string;
  severity: string;
  category: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  confidence: number;
  rationale: string;
}

/** Max length of a preview's plain-text summary, ellipsis included. */
export const SUMMARY_MAX = 140;

/** Max previews per PR on the list; `findings_counts` still covers every finding. */
export const PREVIEW_MAX = 20;

const SEVERITY_ORDER = new Map<string, number>(Severity.options.map((sev, i) => [sev, i]));

/** Markdown rationale → one short plain-text line (code fences and markers dropped). */
export function shortSummary(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > SUMMARY_MAX ? `${plain.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : plain;
}

/** Newest review id per (PR, agent), from reviews ordered newest-first. A
 *  review whose agent was deleted (null) counts once, as its own "agent". */
export function latestReviewIdsPerAgent(
  reviewsNewestFirst: { id: string; prId: string; agentId: string | null }[],
): Map<string, string[]> {
  const seen = new Set<string>();
  const out = new Map<string, string[]>();
  for (const rv of reviewsNewestFirst) {
    const key = `${rv.prId}|${rv.agentId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ids = out.get(rv.prId);
    if (ids) ids.push(rv.id);
    else out.set(rv.prId, [rv.id]);
  }
  return out;
}

export function latestFindingsByPr(
  reviewIdsByPr: Map<string, string[]>,
  rows: FindingPreviewRow[],
): Map<string, PrFindingPreview[]> {
  const byReview = new Map<string, FindingPreviewRow[]>();
  for (const r of rows) {
    // The DB column is free text; the client's badge throws on an unknown level.
    if (!Severity.safeParse(r.severity).success) continue;
    const list = byReview.get(r.reviewId);
    if (list) list.push(r);
    else byReview.set(r.reviewId, [r]);
  }
  const out = new Map<string, PrFindingPreview[]>();
  for (const [prId, reviewIds] of reviewIdsByPr) {
    const sorted = reviewIds.flatMap((id) => byReview.get(id) ?? []).sort(
      (a, b) =>
        SEVERITY_ORDER.get(a.severity)! - SEVERITY_ORDER.get(b.severity)! ||
        b.confidence - a.confidence,
    );
    out.set(
      prId,
      sorted.map((r) => ({
        id: r.id,
        severity: r.severity as PrFindingPreview['severity'],
        category: r.category as PrFindingPreview['category'],
        title: r.title,
        file: r.file,
        start_line: r.startLine,
        end_line: r.endLine,
        confidence: r.confidence,
        summary: shortSummary(r.rationale),
      })),
    );
  }
  return out;
}

/** The list's `findings` (capped preview) + `findings_counts` (full totals);
 *  both null for a PR that was never reviewed. */
export function listFindingsField(list: PrFindingPreview[] | undefined): {
  findings: PrFindingPreview[] | null;
  findings_counts: PrFindingCounts | null;
} {
  if (!list) return { findings: null, findings_counts: null };
  const counts: PrFindingCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of list) counts[f.severity] += 1;
  return { findings: list.slice(0, PREVIEW_MAX), findings_counts: counts };
}
