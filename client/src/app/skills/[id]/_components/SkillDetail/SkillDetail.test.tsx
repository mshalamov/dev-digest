import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../messages/en/skills.json";

const { update, restore, restoreState } = vi.hoisted(() => ({
  update: vi.fn(),
  restore: vi.fn(),
  restoreState: { isError: false, error: null as unknown },
}));
const VERSIONS: SkillVersion[] = [
  { skill_id: "s1", version: 2, body: "# Rule\nnew line", created_at: "2026-10-08T10:00:00.000Z" },
  { skill_id: "s1", version: 1, body: "# Rule\nold line", created_at: "2026-10-07T10:00:00.000Z" },
];
vi.mock("../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: update, isPending: false, isError: false, error: null }),
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false, refetch: vi.fn() }),
  useRestoreSkillVersion: () => ({ mutate: restore, isPending: false, isError: restoreState.isError, error: restoreState.error, variables: undefined }),
}));

import { SkillDetail } from "./SkillDetail";

const SKILL: Skill = {
  id: "s1",
  name: "no-then-chains",
  description: "Flag .then() chains in new code.",
  type: "convention",
  source: "manual",
  body: "# Rule\nnew line",
  enabled: true,
  version: 2,
  agent_ids: [],
  agent_count: 0,
};

afterEach(() => {
  cleanup();
  update.mockReset();
  restore.mockReset();
  restoreState.isError = false;
  restoreState.error = null;
});

function renderTab(tab: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillDetail skill={SKILL} tab={tab} onTab={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("SkillDetail", () => {
  it("has exactly the Config, Preview and Versioning tabs", () => {
    renderTab("config");
    for (const label of ["Config", "Preview", "Versioning"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Stats" })).not.toBeInTheDocument();
  });

  it("Preview renders the markdown body, not the raw text", () => {
    renderTab("preview");
    expect(screen.getByRole("heading", { name: "Rule" })).toBeInTheDocument();
    expect(screen.queryByText("# Rule")).not.toBeInTheDocument();
  });

  it("Config saves edited fields and toggles enabled", () => {
    renderTab("config");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByDisplayValue("Flag .then() chains in new code."), {
      target: { value: "Flag promise chains." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(update).toHaveBeenCalledWith(
      {
        id: "s1",
        patch: { name: "no-then-chains", description: "Flag promise chains.", type: "convention", body: "# Rule\nnew line" },
      },
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("switch"));
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { enabled: false } });
  });

  it("keeps unsaved Config edits when switching to another tab and back", () => {
    const ui = (tab: string) => (
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <SkillDetail skill={SKILL} tab={tab} onTab={() => {}} />
      </NextIntlClientProvider>
    );
    const { rerender } = render(ui("config"));
    fireEvent.change(screen.getByDisplayValue("Flag .then() chains in new code."), {
      target: { value: "Edited description." },
    });
    rerender(ui("preview"));
    rerender(ui("config"));
    expect(screen.getByDisplayValue("Edited description.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("Versioning lists versions, diffs an old one against current, and restores it", () => {
    renderTab("versioning");
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Diff" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Diff" }));
    expect(screen.getByText("- old line")).toBeInTheDocument();
    expect(screen.getByText("+ new line")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restore).toHaveBeenCalledWith({ id: "s1", version: 1 });
  });

  it("Versioning shows an alert when restoring a version fails", () => {
    restoreState.isError = true;
    restoreState.error = new Error("boom");
    renderTab("versioning");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not restore this version.");
  });
});
