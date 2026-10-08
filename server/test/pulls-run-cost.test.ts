/**
 * PR-list cost (`modules/pulls/run-cost.ts`): the COST cell is the TOTAL cost of
 * all of a PR's completed runs. Unfinished runs never contribute, and a PR with
 * no known cost shows nothing rather than a fake $0.
 */
import { describe, it, expect } from 'vitest';
import { totalRunCostByPr, type RunCostRow } from '../src/modules/pulls/run-cost.js';

const run = (o: Partial<RunCostRow> = {}): RunCostRow => ({ prId: 'pr1', status: 'done', costUsd: 0.01, ...o });

describe('totalRunCostByPr', () => {
  it('sums the cost of every done run of a PR', () => {
    const m = totalRunCostByPr([run({ costUsd: 0.0013 }), run({ costUsd: 0.0014 }), run({ costUsd: 0.014 })]);
    expect(m.get('pr1')).toBeCloseTo(0.0167, 10);
  });

  it('keeps PRs separate', () => {
    const m = totalRunCostByPr([run({ prId: 'a', costUsd: 0.1 }), run({ prId: 'b', costUsd: 0.2 }), run({ prId: 'a', costUsd: 0.3 })]);
    expect(m.get('a')).toBeCloseTo(0.4, 10);
    expect(m.get('b')).toBeCloseTo(0.2, 10);
  });

  it('ignores runs that are not done, even if they carry a cost', () => {
    for (const status of ['failed', 'cancelled', 'running', null]) {
      const m = totalRunCostByPr([run({ costUsd: 0.02 }), run({ status, costUsd: 0.3 })]);
      expect(m.get('pr1')).toBe(0.02);
    }
  });

  it('skips done runs with unknown cost; the total is the sum of the known costs', () => {
    const m = totalRunCostByPr([run({ costUsd: 0.02 }), run({ costUsd: null }), run({ costUsd: 0.03 })]);
    expect(m.get('pr1')).toBeCloseTo(0.05, 10);
  });

  it('is null when no done run has a known cost (never a fake 0)', () => {
    expect(totalRunCostByPr([run({ costUsd: null }), run({ costUsd: null })]).get('pr1')).toBeNull();
  });

  it('keeps a real zero (free model) as 0, distinct from null', () => {
    expect(totalRunCostByPr([run({ costUsd: 0 }), run({ costUsd: 0 })]).get('pr1')).toBe(0);
  });

  it('omits PRs with no done run, and rows without a PR', () => {
    const m = totalRunCostByPr([run({ prId: 'pr2', status: 'running', costUsd: null }), run({ prId: null })]);
    expect(m.size).toBe(0);
  });
});
