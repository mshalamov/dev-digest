/**
 * Cost for the PR list: the TOTAL cost of all of a PR's completed runs. Pure so
 * it is unit-testable without a DB. Runs that aren't `done` never contribute; a
 * done run with unknown cost is skipped (the total is the sum of the known
 * costs); a PR with no known cost yields null (rendered "--"), never a fake 0.
 */
export interface RunCostRow {
  prId: string | null;
  status: string | null;
  costUsd: number | null;
}

export function totalRunCostByPr(rows: RunCostRow[]): Map<string, number | null> {
  const total = new Map<string, number | null>();
  for (const r of rows) {
    if (r.prId == null || r.status !== 'done') continue;
    const cur = total.get(r.prId) ?? null;
    total.set(r.prId, r.costUsd == null ? cur : (cur ?? 0) + r.costUsd);
  }
  return total;
}
