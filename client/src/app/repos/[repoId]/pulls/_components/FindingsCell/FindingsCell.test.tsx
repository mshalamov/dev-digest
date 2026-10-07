import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrFindingCounts, PrFindingPreview } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { FindingsCell } from "./FindingsCell";
import { CLOSE_DELAY_MS, POPOVER_MAX_HEIGHT, POPOVER_WIDTH, lineLabel, popoverPosition } from "./helpers";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const F = (id: string, severity: PrFindingPreview["severity"], over: Partial<PrFindingPreview> = {}): PrFindingPreview => ({
  id, severity, category: "security", title: `T-${id}`, file: "src/api/limit.ts",
  start_line: 42, end_line: 42, confidence: 0.91, summary: `S-${id}`, ...over,
});

function renderCell(findings: PrFindingPreview[] | null | undefined, counts?: PrFindingCounts | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsCell findings={findings} counts={counts} />
    </NextIntlClientProvider>,
  );
}

const THREE = [F("a", "CRITICAL"), F("b", "CRITICAL", { start_line: 10, end_line: 14 }), F("c", "WARNING")];

describe("FindingsCell", () => {
  it("shows a count per present severity, most severe first", () => {
    renderCell(THREE);
    const trigger = screen.getByLabelText("3 findings in the latest run");
    expect(within(trigger).getByText("2")).toBeInTheDocument();
    expect(within(trigger).getByText("1")).toBeInTheDocument();
  });

  it("never reviewed → — and no popover trigger; reviewed with nothing kept → 0", () => {
    renderCell(null);
    expect(screen.getByTitle("Not reviewed yet").textContent).toBe("—");
    cleanup();
    renderCell([]);
    expect(screen.getByTitle("The latest run kept no findings").textContent).toBe("0");
    expect(screen.queryByLabelText(/findings in the latest run/)).not.toBeInTheDocument();
  });

  it("hover opens a read-only 'N FINDINGS IN THIS RUN' popover previewing every finding", () => {
    renderCell(THREE);
    fireEvent.mouseEnter(screen.getByLabelText("3 findings in the latest run"));
    const pop = screen.getByRole("dialog", { name: "3 FINDINGS IN THIS RUN" });
    expect(within(pop).getByText("3 FINDINGS IN THIS RUN")).toBeInTheDocument();
    for (const id of ["a", "b", "c"]) {
      expect(within(pop).getByText(`T-${id}`)).toBeInTheDocument();
      expect(within(pop).getByText(`S-${id}`)).toBeInTheDocument();
    }
    expect(within(pop).getByText("src/api/limit.ts:10-14")).toBeInTheDocument();
    expect(within(pop).getAllByText("src/api/limit.ts:42")).toHaveLength(2);
    expect(within(pop).getAllByText("91% confidence")).toHaveLength(3);
    expect(within(pop).getAllByText("security")).toHaveLength(3);
    // read-only: no Accept/Reject, no links
    expect(within(pop).queryAllByRole("button")).toHaveLength(0);
    expect(within(pop).queryAllByRole("link")).toHaveLength(0);
  });

  it("stays open while the pointer travels into the popover; closes after leaving both", () => {
    vi.useFakeTimers();
    renderCell(THREE);
    const trigger = screen.getByLabelText("3 findings in the latest run");
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS * 2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keyboard: focus opens it, Escape closes it", () => {
    renderCell(THREE);
    const trigger = screen.getByLabelText("3 findings in the latest run");
    fireEvent.focus(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("popoverPosition", () => {
  const vp = { width: 1200, height: 800 };
  it("opens below the icons, aligned to their left edge", () => {
    expect(popoverPosition({ top: 100, bottom: 120, left: 500 }, vp)).toEqual({ left: 500, top: 126, maxHeight: POPOVER_MAX_HEIGHT });
  });
  it("flips above when there is no room below", () => {
    const top = 800 - POPOVER_MAX_HEIGHT;
    expect(popoverPosition({ top, bottom: top + 20, left: 500 }, vp)).toEqual({ left: 500, bottom: 800 - top + 6, maxHeight: POPOVER_MAX_HEIGHT });
  });
  it("fits neither side: opens on the roomier side and shrinks so the title stays on screen", () => {
    // 700px viewport, row mid-screen: 316px free below, 326px above (after gap + edge)
    const pos = popoverPosition({ top: 340, bottom: 370, left: 500 }, { width: 1200, height: 700 });
    expect(pos).toEqual({ left: 500, bottom: 700 - 340 + 6, maxHeight: 326 });
    // its top edge (viewport.height - bottom - maxHeight) never goes above the edge margin
    expect(700 - pos.bottom! - pos.maxHeight).toBeGreaterThanOrEqual(8);
  });
  it("prefers below when below is roomier, shrinking to fit", () => {
    // 600px viewport: 306px free below vs 246px above
    expect(popoverPosition({ top: 260, bottom: 280, left: 500 }, { width: 1200, height: 600 })).toEqual({
      left: 500, top: 286, maxHeight: 306,
    });
  });
  it("stays inside the viewport horizontally", () => {
    expect(popoverPosition({ top: 100, bottom: 120, left: 1150 }, vp).left).toBe(1200 - POPOVER_WIDTH - 8);
    expect(popoverPosition({ top: 100, bottom: 120, left: 2 }, vp).left).toBe(8);
  });
});

describe("lineLabel", () => {
  it("single line vs range", () => {
    expect(lineLabel({ start_line: 42, end_line: 42 })).toBe("42");
    expect(lineLabel({ start_line: 10, end_line: 14 })).toBe("10-14");
  });
});

describe("FindingsCell — review follow-ups", () => {
  it("a capped preview: icons and title use the full counts, with a '+N more' note", () => {
    renderCell(THREE, { CRITICAL: 5, WARNING: 20, SUGGESTION: 0 });
    const trigger = screen.getByLabelText("25 findings in the latest run");
    expect(within(trigger).getByText("5")).toBeInTheDocument();
    expect(within(trigger).getByText("20")).toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    const pop = screen.getByRole("dialog", { name: "25 FINDINGS IN THIS RUN" });
    expect(within(pop).getByText("+22 more on the PR page")).toBeInTheDocument();
  });

  it("singular copy for one finding", () => {
    renderCell([F("a", "WARNING")]);
    fireEvent.mouseEnter(screen.getByLabelText("1 finding in the latest run"));
    expect(screen.getByRole("dialog", { name: "1 FINDING IN THIS RUN" })).toBeInTheDocument();
  });

  it("Escape closes a hover-opened popover even when the trigger has no focus", () => {
    renderCell(THREE);
    fireEvent.mouseEnter(screen.getByLabelText("3 findings in the latest run"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["scroll", () => fireEvent.scroll(window)],
    ["resize", () => fireEvent(window, new Event("resize"))],
  ])("closes on %s instead of floating away from its row", (_label, fire) => {
    renderCell(THREE);
    fireEvent.focus(screen.getByLabelText("3 findings in the latest run"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => fire());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("scrolling inside the popover's own list keeps it open", () => {
    renderCell(THREE);
    fireEvent.focus(screen.getByLabelText("3 findings in the latest run"));
    act(() => {
      fireEvent.scroll(screen.getByRole("dialog"));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("the trigger is a button described by the open popover", () => {
    renderCell(THREE);
    const trigger = screen.getByRole("button", { name: "3 findings in the latest run" });
    expect(trigger).not.toHaveAttribute("aria-describedby");
    fireEvent.focus(trigger);
    const pop = screen.getByRole("dialog");
    expect(pop.id).not.toBe("");
    expect(trigger).toHaveAttribute("aria-describedby", pop.id);
  });

  it("an unknown severity (bad data) is skipped instead of crashing the list", () => {
    const bad = { ...F("x", "WARNING"), severity: "INFO" } as unknown as PrFindingPreview;
    renderCell([F("a", "CRITICAL"), bad]);
    fireEvent.mouseEnter(screen.getByLabelText("1 finding in the latest run"));
    const pop = screen.getByRole("dialog", { name: "1 FINDING IN THIS RUN" });
    expect(within(pop).queryByText("T-x")).not.toBeInTheDocument();
  });
});
