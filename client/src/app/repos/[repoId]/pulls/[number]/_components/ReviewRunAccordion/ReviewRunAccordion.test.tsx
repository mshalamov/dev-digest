import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReviewRecord, RunSummary } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ReviewRunAccordion } from "./ReviewRunAccordion";

afterEach(cleanup);

const REVIEW: ReviewRecord = {
  id: "rv1",
  pr_id: "pr1",
  agent_id: "a1",
  run_id: "run-1",
  agent_name: "Security Reviewer",
  kind: "review",
  verdict: "request_changes",
  summary: "Two critical exposures.",
  score: 38,
  model: "openrouter/deepseek-v4-flash",
  grounding: "3/3 passed",
  created_at: "2026-06-13T20:52:51.000Z",
  findings: [],
};

const RUN = (cost_usd: number | null): RunSummary => ({
  run_id: "run-1",
  agent_id: "a1",
  agent_name: "Security Reviewer",
  provider: "openrouter",
  model: "deepseek/deepseek-v4-flash",
  status: "done",
  error: null,
  duration_ms: 8200,
  tokens_in: 9119,
  tokens_out: 1240,
  cost_usd,
  findings_count: 0,
  grounding: "3/3 passed",
  ran_at: "2026-06-13T20:52:51.000Z",
  score: 38,
  blockers: 2,
});

function renderCard(run: RunSummary | null | undefined, defaultOpen = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <ReviewRunAccordion review={REVIEW} prId="pr1" run={run} defaultOpen={defaultOpen} />
    </NextIntlClientProvider>,
  );
}

describe("ReviewRunAccordion — cost", () => {
  it("shows the run's compact cost in the collapsed header", () => {
    renderCard(RUN(0.0013));
    expect(screen.getByText("$0.0013")).toBeInTheDocument();
  });

  it("header cost sits between the score and the time", () => {
    renderCard(RUN(0.0013));
    const score = screen.getByText("38");
    const cost = screen.getByText("$0.0013");
    const when = screen.getByText(new Date(REVIEW.created_at).toLocaleString());
    expect(score.compareDocumentPosition(cost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cost.compareDocumentPosition(when) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["unknown cost", RUN(null)],
    ["no matching run (deleted)", null],
    ["runs not loaded", undefined],
  ])("shows -- for %s, never $0.00", (_label, run) => {
    renderCard(run);
    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("the expanded verdict banner does not repeat the cost", () => {
    renderCard(RUN(0.0013));
    fireEvent.click(screen.getByText("Security Reviewer"));
    expect(screen.getAllByText(/\$0\.0013/)).toHaveLength(1);
  });
});
