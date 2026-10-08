import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { VerdictBanner } from "./VerdictBanner";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("VerdictBanner (smoke)", () => {
  it("shows verdict label + score + finding/blocker counts", () => {
    renderWithIntl(
      <VerdictBanner
        verdict="request_changes"
        summary="Hardcoded secret introduced."
        score={42}
        findingsCount={1}
        blockers={1}
        agentName="Security Reviewer"
      />,
    );
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1 findings · 1 blockers/)).toBeInTheDocument();
  });
  it("shows the N CRITICAL · N WARNING · N SUGGESTION pill row under the verdict and score", () => {
    renderWithIntl(
      <VerdictBanner verdict="request_changes" summary="s" score={61} findingsCount={6} blockers={2}
        severityCounts={{ CRITICAL: 2, WARNING: 3, SUGGESTION: 1 }} />,
    );
    expect(screen.getByRole("group", { name: "Findings by severity" })).toBeInTheDocument();
    for (const name of ["2 CRITICAL", "3 WARNING", "1 SUGGESTION"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("has no pill row without counts, or when every count is 0", () => {
    renderWithIntl(
      <VerdictBanner verdict="approve" summary="s" score={95} findingsCount={0} blockers={0}
        severityCounts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} />,
    );
    expect(screen.queryByRole("group", { name: "Findings by severity" })).not.toBeInTheDocument();
  });

  it("clicking a pill calls onSeverityToggle with that level", () => {
    const onSeverityToggle = vi.fn();
    renderWithIntl(
      <VerdictBanner verdict="comment" summary="s" score={70} findingsCount={1} blockers={0}
        severityCounts={{ CRITICAL: 0, WARNING: 1, SUGGESTION: 0 }} onSeverityToggle={onSeverityToggle} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1 WARNING" }));
    expect(onSeverityToggle).toHaveBeenCalledWith("WARNING");
  });
});
