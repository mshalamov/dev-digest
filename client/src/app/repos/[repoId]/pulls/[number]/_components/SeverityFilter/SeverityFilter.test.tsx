import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { SeverityFilter } from "./SeverityFilter";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SeverityFilter", () => {
  it("always offers Critical, Warning and Suggestion, in that order", () => {
    renderWithIntl(<SeverityFilter active={null} onToggle={() => {}} />);
    const group = screen.getByRole("group", { name: "Filter findings by severity" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Critical", "Warning", "Suggestion"]);
    for (const b of screen.getAllByRole("button")) expect(b).toHaveAttribute("aria-pressed", "false");
  });

  it("reports clicks and marks the active level", () => {
    const onToggle = vi.fn();
    renderWithIntl(<SeverityFilter active="SUGGESTION" onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Suggestion" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(onToggle).toHaveBeenCalledWith("CRITICAL");
  });
});
