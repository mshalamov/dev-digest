import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/prReview.json";
import type { PrMeta } from "@/lib/types";
import type { PrFindingPreview } from "@devdigest/shared";
import { PRRow } from "./PRRow";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(cleanup);

const pr = (over: Partial<PrMeta>): PrMeta => ({
  number: 482, title: "Add rate limiting", author: "marisa.koch", branch: "f", base: "main",
  head_sha: "abc", additions: 10, deletions: 2, files_count: 1, status: "reviewed",
  updated_at: new Date().toISOString(), score: 61, ...over,
});

function renderRow(p: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={p} repoId="r1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow cost column", () => {
  it("shows the PR's total cost, labelled as a total of all runs", () => {
    renderRow(pr({ cost_usd: 0.012 }));
    expect(screen.getByTitle("Total cost of all runs on this PR").textContent).toBe("$0.012");
  });
  it("shows -- when the PR has no cost data (unreviewed, or cost unknown)", () => {
    renderRow(pr({ cost_usd: null, score: null }));
    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
  it("shows -- when cost_usd is absent from the payload", () => {
    renderRow(pr({}));
    expect(screen.getByText("--")).toBeInTheDocument();
  });
});

const finding = (id: string, severity: PrFindingPreview["severity"]): PrFindingPreview => ({
  id, severity, category: "bug", title: `T-${id}`, file: "a.ts", start_line: 1, end_line: 1, confidence: 0.8, summary: "s",
});

describe("PRRow findings column", () => {
  it("renders the FINDINGS cell from pr.findings", () => {
    renderRow(pr({ findings: [finding("a", "CRITICAL"), finding("b", "SUGGESTION")] }));
    expect(screen.getByLabelText("2 findings in the latest run")).toBeInTheDocument();
  });

  it("clicking inside the popover does not open the PR", () => {
    push.mockClear();
    renderRow(pr({ findings: [finding("a", "CRITICAL")] }));
    fireEvent.mouseEnter(screen.getByLabelText("1 finding in the latest run"));
    fireEvent.click(within(screen.getByRole("dialog")).getByText("T-a"));
    expect(push).not.toHaveBeenCalled();
  });

  it("tapping/clicking the severity icons opens the preview, not the PR", () => {
    push.mockClear();
    renderRow(pr({ findings: [finding("a", "CRITICAL")] }));
    fireEvent.click(screen.getByLabelText("1 finding in the latest run"));
    expect(push).not.toHaveBeenCalled();
  });

  it("passes the full counts through to the cell", () => {
    renderRow(pr({ findings: [finding("a", "CRITICAL")], findings_counts: { CRITICAL: 3, WARNING: 0, SUGGESTION: 0 } }));
    expect(screen.getByLabelText("3 findings in the latest run")).toBeInTheDocument();
  });

  it("clicking the row elsewhere still opens the PR", () => {
    push.mockClear();
    renderRow(pr({ findings: [] }));
    fireEvent.click(screen.getByText("Add rate limiting"));
    expect(push).toHaveBeenCalledWith("/repos/r1/pulls/482");
  });
});
