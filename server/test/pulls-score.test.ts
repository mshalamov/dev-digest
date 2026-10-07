/**
 * PR-list SCORE (`modules/pulls/score.ts`): the lowest score among the newest
 * review of each agent, from the same reviews as the FINDINGS column, so a
 * clean run by one agent never shows 100 next to another agent's CRITICAL.
 */
import { describe, it, expect } from 'vitest';
import { lowestLatestScoreByPr, type ScoredReviewRow } from '../src/modules/pulls/score.js';

const rv = (id: string, prId: string, agentId: string | null, score: number | null): ScoredReviewRow => ({
  id, prId, agentId, score,
});

describe('lowestLatestScoreByPr', () => {
  it("is the lowest of each agent's newest score (Run all agents: 85, 100, 100 → 85)", () => {
    // newest-first, as the route queries them
    const m = lowestLatestScoreByPr([
      rv('c', 'pr1', 'agentC', 100),
      rv('b', 'pr1', 'agentB', 100),
      rv('a', 'pr1', 'agentA', 85),
    ]);
    expect(m.get('pr1')).toBe(85);
  });

  it("an agent's older, lower score no longer counts once it re-reviewed", () => {
    const m = lowestLatestScoreByPr([
      rv('a-new', 'pr1', 'agentA', 95),
      rv('b', 'pr1', 'agentB', 90),
      rv('a-old', 'pr1', 'agentA', 20),
    ]);
    expect(m.get('pr1')).toBe(90);
  });

  it('ignores reviews without a score; null only when no newest review has one', () => {
    expect(lowestLatestScoreByPr([rv('a', 'pr1', 'agentA', null), rv('b', 'pr1', 'agentB', 70)]).get('pr1')).toBe(70);
    expect(lowestLatestScoreByPr([rv('a', 'pr1', 'agentA', null)]).get('pr1')).toBeNull();
  });

  it('keeps PRs apart; PRs without reviews are absent', () => {
    const m = lowestLatestScoreByPr([rv('x', 'pr1', 'agentA', 40), rv('y', 'pr2', 'agentA', 90)]);
    expect(m.get('pr1')).toBe(40);
    expect(m.get('pr2')).toBe(90);
    expect(m.has('pr3')).toBe(false);
  });
});
