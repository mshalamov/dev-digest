import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { filterSkills } from "./helpers";

const { skills, update, del, delState } = vi.hoisted(() => ({
  delState: { isError: false },
  skills: { current: [] as Skill[] },
  update: vi.fn(),
  del: vi.fn(),
}));
vi.mock("../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills.current, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useDeleteSkill: () => ({ mutate: del, isPending: false, isError: delState.isError, variables: undefined }),
  useCreateSkill: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  usePreviewSkillImport: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { SkillsListView } from "./SkillsListView";

const mk = (id: string, name: string, enabled = true): Skill => ({
  id,
  name,
  description: `About ${name}`,
  type: "convention",
  source: "manual",
  body: `# ${name} heading\n\nRule text.`,
  enabled,
  version: 1,
  agent_ids: [],
  agent_count: 0,
});

afterEach(() => {
  cleanup();
  update.mockReset();
  del.mockReset();
  delState.isError = false;
});

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillsListView />
    </NextIntlClientProvider>,
  );
}

describe("SkillsListView", () => {
  it("offers create or import from the Add menu, each in a modal", () => {
    skills.current = [mk("s1", "no-then-chains")];
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(within(screen.getByRole("dialog")).getByPlaceholderText("boundary-cases")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Import from file (.md / .zip)" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Skill file")).toBeInTheDocument();
  });
  it("renders a card per skill and opens a side preview with the rendered body", () => {
    skills.current = [mk("s1", "no-then-chains"), mk("s2", "secret-leakage")];
    renderView();
    expect(screen.getByText("no-then-chains")).toBeInTheDocument();
    expect(screen.getByText("secret-leakage")).toBeInTheDocument();

    fireEvent.click(screen.getByText("secret-leakage"));
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByRole("heading", { name: "secret-leakage heading" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Open skill" })).toBeInTheDocument();
  });

  it("toggles a skill and filters by search text", () => {
    skills.current = [mk("s1", "no-then-chains"), mk("s2", "secret-leakage")];
    renderView();
    fireEvent.click(screen.getAllByRole("switch")[0]!);
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { enabled: false } });

    fireEvent.change(screen.getByPlaceholderText("Search skills…"), { target: { value: "secret" } });
    expect(screen.queryByText("no-then-chains")).not.toBeInTheDocument();
    expect(screen.getByText("secret-leakage")).toBeInTheDocument();
  });

  it("shows the empty state when there are no skills", () => {
    skills.current = [];
    renderView();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });
});

describe("filterSkills", () => {
  it("matches name or description, case-insensitively", () => {
    const list = [mk("s1", "no-then-chains"), mk("s2", "secret-leakage")];
    expect(filterSkills(list, "  SECRET ").map((s) => s.id)).toEqual(["s2"]);
    expect(filterSkills(list, "about no").map((s) => s.id)).toEqual(["s1"]);
    expect(filterSkills(list, "")).toHaveLength(2);
  });

  it("shows an alert when deleting a skill fails", () => {
    skills.current = [mk("s1", "alpha")];
    delState.isError = true;
    renderView();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not delete the skill.");
  });
});
