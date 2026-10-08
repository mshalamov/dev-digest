import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";
import { SkillFormFields } from "./SkillFormFields";
import { EMPTY_DRAFT } from "./helpers";

afterEach(cleanup);

describe("SkillFormFields", () => {
  it("renders name, description (with the directive caption), type and markdown body", () => {
    const onChange = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <SkillFormFields value={EMPTY_DRAFT} onChange={onChange} errors={{ name: "required" }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText(/phrase it as a directive/)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("custom");
    expect(screen.getByText("Body (Markdown)")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required.");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "security" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_DRAFT, type: "security" });
  });
});
