/**
 * PR-list FINDINGS column (`modules/pulls/findings-preview.ts`): the preview of
 * the latest review's findings, which is the same review the score ring uses.
 * The client counts per severity and renders the hover popover from this.
 */
import { describe, it, expect } from 'vitest';
import {
  latestFindingsByPr,
  latestReviewIdsPerAgent,
  listFindingsField,
  shortSummary,
  PREVIEW_MAX,
  SUMMARY_MAX,
  type FindingPreviewRow,
} from '../src/modules/pulls/findings-preview.js';

const row = (o: Partial<FindingPreviewRow> & { id: string; reviewId: string }): FindingPreviewRow => ({
  severity: 'WARNING',
  category: 'bug',
  title: 't',
  file: 'src/a.ts',
  startLine: 1,
  endLine: 1,
  confidence: 0.8,
  rationale: 'r',
  ...o,
});

describe('latestFindingsByPr', () => {
  it("keeps only the latest review's findings, most severe first, then by confidence", () => {
    const m = latestFindingsByPr(new Map([['pr1', ['rvNew']]]), [
      row({ id: 'old', reviewId: 'rvOld', severity: 'CRITICAL' }),
      row({ id: 's', reviewId: 'rvNew', severity: 'SUGGESTION', confidence: 0.99 }),
      row({ id: 'w-lo', reviewId: 'rvNew', severity: 'WARNING', confidence: 0.6 }),
      row({ id: 'c', reviewId: 'rvNew', severity: 'CRITICAL' }),
      row({ id: 'w-hi', reviewId: 'rvNew', severity: 'WARNING', confidence: 0.9 }),
    ]);
    expect(m.get('pr1')!.map((f) => f.id)).toEqual(['c', 'w-hi', 'w-lo', 's']);
  });

  it('maps DB columns to the wire shape, rationale → plain summary', () => {
    const m = latestFindingsByPr(new Map([['pr1', ['rv']]]), [
      row({ id: 'f1', reviewId: 'rv', severity: 'CRITICAL', category: 'security', title: 'Secret',
        file: 'src/cfg.ts', startLine: 10, endLine: 12, confidence: 0.91, rationale: '**Key** is committed.' }),
    ]);
    expect(m.get('pr1')).toEqual([
      { id: 'f1', severity: 'CRITICAL', category: 'security', title: 'Secret', file: 'src/cfg.ts',
        start_line: 10, end_line: 12, confidence: 0.91, summary: 'Key is committed.' },
    ]);
  });

  it('a reviewed PR whose latest review kept nothing gets [] (not null)', () => {
    expect(latestFindingsByPr(new Map([['pr1', ['rv']]]), []).get('pr1')).toEqual([]);
  });

  it('PRs without a review are absent (the route renders null)', () => {
    expect(latestFindingsByPr(new Map(), [row({ id: 'f', reviewId: 'rv' })]).size).toBe(0);
  });
});

describe('shortSummary', () => {
  it('strips markdown markers and collapses whitespace', () => {
    expect(shortSummary('**Bold** `code`\n\n# h')).toBe('Bold code h');
  });
  it('drops fenced code blocks', () => {
    expect(shortSummary('Use this:\n```ts\nconst x = 1;\n```\ninstead')).toBe('Use this: instead');
  });
  it(`cuts to ${SUMMARY_MAX} chars ending in an ellipsis`, () => {
    const s = shortSummary('a'.repeat(500));
    expect(s).toHaveLength(SUMMARY_MAX);
    expect(s.endsWith('…')).toBe(true);
  });
});

describe('unknown severities (free-text DB column)', () => {
  it('are dropped, never shipped to the client (its badge would throw on them)', () => {
    const m = latestFindingsByPr(new Map([['pr1', ['rv']]]), [
      row({ id: 'ok', reviewId: 'rv', severity: 'WARNING' }),
      row({ id: 'info', reviewId: 'rv', severity: 'INFO' }),
      row({ id: 'proto', reviewId: 'rv', severity: '__proto__' }),
      row({ id: 'lower', reviewId: 'rv', severity: 'critical' }),
    ]);
    expect(m.get('pr1')!.map((f) => f.id)).toEqual(['ok']);
  });
});

describe('listFindingsField', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `f${i}`, severity: (i % 3 === 0 ? 'CRITICAL' : 'SUGGESTION') as 'CRITICAL' | 'SUGGESTION',
      category: 'bug' as const, title: 't', file: 'a.ts', start_line: 1, end_line: 1, confidence: 0.5, summary: 's',
    }));

  it(`caps the preview at ${PREVIEW_MAX} but counts every finding`, () => {
    const out = listFindingsField(many(50));
    expect(out.findings).toHaveLength(PREVIEW_MAX);
    expect(out.findings_counts).toEqual({ CRITICAL: 17, WARNING: 0, SUGGESTION: 33 });
  });

  it('small lists pass through whole', () => {
    const out = listFindingsField(many(3));
    expect(out.findings).toHaveLength(3);
    expect(out.findings_counts).toEqual({ CRITICAL: 1, WARNING: 0, SUGGESTION: 2 });
  });

  it('never reviewed → both null', () => {
    expect(listFindingsField(undefined)).toEqual({ findings: null, findings_counts: null });
  });
});

describe('multi-agent PRs ("Run all agents")', () => {
  it('takes the newest review of EACH agent, not just the newest review overall', () => {
    // newest-first, as the route queries them
    const m = latestReviewIdsPerAgent([
      { id: 'c-new', prId: 'pr1', agentId: 'agentC' },
      { id: 'b-new', prId: 'pr1', agentId: 'agentB' },
      { id: 'a-new', prId: 'pr1', agentId: 'agentA' },
      { id: 'c-old', prId: 'pr1', agentId: 'agentC' },
      { id: 'a-old', prId: 'pr1', agentId: 'agentA' },
      { id: 'x', prId: 'pr2', agentId: 'agentA' },
    ]);
    expect(m.get('pr1')).toEqual(['c-new', 'b-new', 'a-new']);
    expect(m.get('pr2')).toEqual(['x']);
  });

  it('reviews whose agent was deleted (agentId null) count once, newest only', () => {
    const m = latestReviewIdsPerAgent([
      { id: 'n1', prId: 'pr1', agentId: null },
      { id: 'n2', prId: 'pr1', agentId: null },
    ]);
    expect(m.get('pr1')).toEqual(['n1']);
  });

  it("merges every listed review's findings, so one agent's findings are not hidden by another's clean run", () => {
    const m = latestFindingsByPr(new Map([['pr1', ['clean', 'found']]]), [
      row({ id: 'w', reviewId: 'found', severity: 'WARNING' }),
      row({ id: 's', reviewId: 'found', severity: 'SUGGESTION' }),
      row({ id: 'stale', reviewId: 'older', severity: 'CRITICAL' }),
    ]);
    expect(m.get('pr1')!.map((f) => f.id)).toEqual(['w', 's']);
  });
});
