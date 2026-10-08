import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { SeverityPills } from "./SeverityPills";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SeverityPills", () => {
  it("shows only the severities that are present, most severe first", () => {
    renderWithIntl(<SeverityPills counts={{ CRITICAL: 2, WARNING: 0, SUGGESTION: 3 }} />);
    const group = screen.getByRole("group", { name: "Findings by severity" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["2 CRITICAL", "3 SUGGESTION"]);
    expect(screen.queryByText(/WARNING/)).not.toBeInTheDocument();
    expect(screen.getAllByText("·")).toHaveLength(1);
  });

  it("renders nothing when the run has no findings", () => {
    renderWithIntl(<SeverityPills counts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("reports the clicked severity and marks the active pill as pressed", () => {
    const onToggle = vi.fn();
    renderWithIntl(
      <SeverityPills counts={{ CRITICAL: 1, WARNING: 2, SUGGESTION: 0 }} active="WARNING" onToggle={onToggle} />,
    );
    expect(screen.getByRole("button", { name: "2 WARNING" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1 CRITICAL" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    expect(onToggle).toHaveBeenCalledWith("CRITICAL");
  });
});
