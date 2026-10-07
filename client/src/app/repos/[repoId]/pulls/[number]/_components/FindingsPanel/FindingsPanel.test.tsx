import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, Severity } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

const mk = (id: string, severity: Severity, title: string): FindingRecord => ({ ...FINDINGS[0]!, id, severity, title });
const MIXED = [
  mk("c1", "CRITICAL", "Crit A"),
  mk("w1", "WARNING", "Warn A"),
  mk("w2", "WARNING", "Warn B"),
  mk("s1", "SUGGESTION", "Sugg A"),
];

describe("FindingsPanel — severity filter", () => {
  it("a filter button keeps only that level; a second click restores the full list", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "Warning" }));
    expect(screen.queryByText("Crit A")).not.toBeInTheDocument();
    expect(screen.getByText("Warn A")).toBeInTheDocument();
    expect(screen.getByText("Warn B")).toBeInTheDocument();
    expect(screen.queryByText("Sugg A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Warning" }));
    for (const title of ["Crit A", "Warn A", "Warn B", "Sugg A"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("controlled: renders the given level and reports the toggled value", () => {
    const onSeverityChange = vi.fn();
    renderWithIntl(
      <FindingsPanel findings={MIXED} prId="pr1" severity="CRITICAL" onSeverityChange={onSeverityChange} />,
    );
    expect(screen.getByText("Crit A")).toBeInTheDocument();
    expect(screen.queryByText("Warn A")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(onSeverityChange).toHaveBeenCalledWith(null);
  });

  it("keyboard accept after filtering acts on the first VISIBLE card, never a hidden one", () => {
    mutate.mockClear();
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.keyDown(window, { key: "j" }); // focus moves to the 2nd card (Warn A) in the full list
    fireEvent.click(screen.getByRole("button", { name: "Suggestion" }));
    fireEvent.keyDown(window, { key: "a" });
    expect(mutate).toHaveBeenCalledWith({ findingId: "s1", action: "accept", prId: "pr1" });
  });
});

describe("FindingsPanel — review follow-ups", () => {
  it("keyboard focus is clamped when a refetch shrinks the list", () => {
    mutate.mockClear();
    const { rerender } = renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: "j" }); // focus on the 4th card
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={MIXED.slice(0, 2)} prId="pr1" />
      </NextIntlClientProvider>,
    );
    fireEvent.keyDown(window, { key: "a" });
    expect(mutate).toHaveBeenCalledWith({ findingId: "w1", action: "accept", prId: "pr1" });
  });

  it("orders by severity, then confidence (same order as the PR-list popover)", () => {
    const lo = { ...mk("w-lo", "WARNING", "Warn low"), confidence: 0.7 };
    const hi = { ...mk("w-hi", "WARNING", "Warn high"), confidence: 0.95 };
    const { container } = renderWithIntl(<FindingsPanel findings={[lo, hi]} prId="pr1" />);
    const ids = [...container.querySelectorAll("[data-finding-id]")].map((el) => el.getAttribute("data-finding-id"));
    expect(ids).toEqual(["w-hi", "w-lo"]);
  });
});
