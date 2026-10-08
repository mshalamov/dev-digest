import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, Skill, SkillType } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";

const mk = (id: string, name: string, type: SkillType, enabled = true): Skill => ({
  id,
  name,
  description: "d",
  type,
  source: "manual",
  body: "b",
  enabled,
  version: 1,
});
const SKILLS = [
  mk("s1", "pr-quality-rubric", "rubric"),
  mk("s2", "no-then-chains", "convention"),
  mk("s3", "secret-leakage-gate", "security", false),
];
const LINKS: AgentSkillLink[] = [
  { agent_id: "a1", skill_id: "s3", order: 0 },
  { agent_id: "a1", skill_id: "s1", order: 1 },
];
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: LINKS, isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: save, isPending: false, isError: false }),
}));

import { SkillsTab } from "./SkillsTab";

const AGENT = { id: "a1", name: "Test Quality Reviewer" } as Agent;
const row = (name: string) => screen.getByText(name).closest("[draggable]") as HTMLElement;

afterEach(() => {
  cleanup();
  save.mockReset();
});

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages, skills: skillsMessages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

describe("Agent Skills tab", () => {
  it("lists every skill with its type, linked ones first in prompt order", () => {
    renderTab();
    expect(screen.getByText("2 of 3 enabled")).toBeInTheDocument();
    const names = screen
      .getAllByText(/^(pr-quality-rubric|no-then-chains|secret-leakage-gate)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["secret-leakage-gate", "pr-quality-rubric", "no-then-chains"]);
    expect(within(row("no-then-chains")).getByText("convention")).toBeInTheDocument();
    expect(within(row("secret-leakage-gate")).getByText("off globally")).toBeInTheDocument();
  });

  it("only enabled (linked) skills can be dragged", () => {
    renderTab();
    expect(row("pr-quality-rubric").getAttribute("draggable")).toBe("true");
    expect(row("no-then-chains").getAttribute("draggable")).toBe("false");
  });

  it("toggling links or unlinks a skill", () => {
    renderTab();
    fireEvent.click(within(row("no-then-chains")).getByRole("checkbox"));
    expect(save).toHaveBeenCalledWith({ agentId: "a1", skillIds: ["s3", "s1", "s2"] });
    fireEvent.click(within(row("pr-quality-rubric")).getByRole("checkbox"));
    expect(save).toHaveBeenLastCalledWith({ agentId: "a1", skillIds: ["s3"] });
  });

  it("dropping one enabled skill on another reorders the prompt", () => {
    renderTab();
    const setData = vi.fn();
    fireEvent.dragStart(row("pr-quality-rubric"), { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "s1"); // Firefox needs drag data to start
    fireEvent.dragOver(row("secret-leakage-gate"));
    fireEvent.drop(row("secret-leakage-gate"));
    expect(save).toHaveBeenCalledWith({ agentId: "a1", skillIds: ["s1", "s3"] });
  });

  it("dragging a disabled skill does nothing", () => {
    renderTab();
    fireEvent.dragStart(row("no-then-chains"));
    fireEvent.drop(row("secret-leakage-gate"));
    expect(save).not.toHaveBeenCalled();
  });

  it("filters by name", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "secret" } });
    expect(screen.queryByText("pr-quality-rubric")).not.toBeInTheDocument();
    expect(screen.getByText("secret-leakage-gate")).toBeInTheDocument();
  });
});
