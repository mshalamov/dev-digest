import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "s1",
  name: "boundary-cases",
  description: "Flag tests that skip boundary values.",
  type: "rubric",
  source: "imported_file",
  body: "# Boundary",
  enabled: true,
  version: 3,
  agent_ids: ["a1", "a2"],
  agent_count: 2,
};

function setup(over: Partial<React.ComponentProps<typeof SkillCard>> = {}) {
  const props = { skill: SKILL, onOpen: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn(), ...over };
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillCard {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

describe("SkillCard", () => {
  it("shows name, type, description, version, agent count and source", () => {
    setup();
    expect(screen.getByText("boundary-cases")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Flag tests that skip boundary values.")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  it("toggles without opening the preview", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("switch"));
    expect(p.onToggle).toHaveBeenCalledWith(false);
    expect(p.onOpen).not.toHaveBeenCalled();
  });

  it("opens on click", () => {
    const p = setup();
    fireEvent.click(screen.getByText("boundary-cases"));
    expect(p.onOpen).toHaveBeenCalled();
  });

  it("deletes only after the modal is confirmed", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    const dialog = screen.getByRole("dialog");
    // Rendered beside the card, so it does not inherit a disabled card's opacity.
    expect(dialog.closest('[role="button"]')).toBeNull();
    expect(within(dialog).getByText(/detached from 2 agents/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(p.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Delete" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(p.onDelete).toHaveBeenCalledTimes(1);
    expect(p.onOpen).not.toHaveBeenCalled();
  });

  it("opens on Enter only when the card itself has focus", () => {
    const p = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "Delete skill" }), { key: "Enter" });
    expect(p.onOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByText("boundary-cases").closest('[role="button"]')!, { key: "Enter" });
    expect(p.onOpen).toHaveBeenCalledTimes(1);
  });
});
