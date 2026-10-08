import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../messages/en/agents.json";

const { mutate, delState } = vi.hoisted(() => ({ mutate: vi.fn(), delState: { isError: false } }));
vi.mock("../../../../lib/hooks/agents", () => ({
  useDeleteAgent: () => ({ mutate, isPending: false, isError: delState.isError }),
}));

import { AgentCard } from "./AgentCard";

afterEach(() => {
  cleanup();
  mutate.mockReset();
  delState.isError = false;
});

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("AgentCard", () => {
  it("renders the agent name, model chip and skill count", () => {
    renderWithIntl(<AgentCard ag={AGENT} skillCount={3} />);
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("3 skills")).toBeInTheDocument();
  });

  it("falls back to a translated placeholder when description is empty", () => {
    renderWithIntl(<AgentCard ag={{ ...AGENT, description: "" }} />);
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("asks for confirmation in a modal before deleting", () => {
    const onClick = vi.fn();
    const { container } = renderWithIntl(<AgentCard ag={{ ...AGENT, enabled: false }} onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete agent" }));
    expect(screen.getByText("Delete agent?")).toBeInTheDocument();
    // Rendered beside the card, so a disabled agent's 0.6 opacity does not dim it.
    expect(container.firstChild).not.toContainElement(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete agent?")).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mutate).toHaveBeenCalledWith("ag1", expect.anything());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows an alert when deleting fails", () => {
    delState.isError = true;
    renderWithIntl(<AgentCard ag={AGENT} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete agent" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not delete the agent.");
  });
});
