import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../../lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: create, isPending: false, isError: false, error: null }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

afterEach(() => {
  cleanup();
  create.mockReset();
});

function setup() {
  const onCreated = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <CreateSkillModal onClose={vi.fn()} onCreated={onCreated} />
    </NextIntlClientProvider>,
  );
  return { onCreated };
}

describe("CreateSkillModal", () => {
  it("blocks an incomplete skill, then creates a complete one", () => {
    const { onCreated } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(3);

    fireEvent.change(screen.getByPlaceholderText("boundary-cases"), { target: { value: "boundary-cases" } });
    fireEvent.change(screen.getByPlaceholderText(/Flag tests that only cover/), {
      target: { value: "Flag tests that skip boundary values." },
    });
    fireEvent.change(screen.getByPlaceholderText(/# Rule/), { target: { value: "# Boundaries\nTest 0 and max." } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "rubric" } });

    create.mockImplementation((_input, opts) => opts.onSuccess({ id: "s9" }));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(create).toHaveBeenCalledWith(
      {
        name: "boundary-cases",
        description: "Flag tests that skip boundary values.",
        type: "rubric",
        body: "# Boundaries\nTest 0 and max.",
      },
      expect.anything(),
    );
    expect(onCreated).toHaveBeenCalledWith({ id: "s9" });
  });
});
