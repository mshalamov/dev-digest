import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/prReview.json";
import type { PrMeta } from "@/lib/types";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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
