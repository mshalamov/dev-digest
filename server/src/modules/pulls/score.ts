import { latestReviewIdsPerAgent } from './findings-preview.js';

/**
 * SCORE on the PR list: the lowest score among the newest review of each agent
 * on the PR, the same reviews the FINDINGS column uses. "Run all agents" writes
 * one review per agent, so the newest review alone could show 100 next to
 * another agent's CRITICAL. Pure so it is unit-testable without a DB.
 */
export interface ScoredReviewRow {
  id: string;
  prId: string;
  agentId: string | null;
  score: number | null;
}

/** Reviews ordered newest-first. Unscored reviews are skipped; a PR whose
 *  newest per-agent reviews have no score at all gets null. */
export function lowestLatestScoreByPr(reviewsNewestFirst: ScoredReviewRow[]): Map<string, number | null> {
  const scoreById = new Map(reviewsNewestFirst.map((r) => [r.id, r.score]));
  const out = new Map<string, number | null>();
  for (const [prId, ids] of latestReviewIdsPerAgent(reviewsNewestFirst)) {
    const scores = ids.map((id) => scoreById.get(id)).filter((s): s is number => s != null);
    out.set(prId, scores.length > 0 ? Math.min(...scores) : null);
  }
  return out;
}
