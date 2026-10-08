import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillImportPreview } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";

const PREVIEW: SkillImportPreview = {
  name: "boundary-cases",
  description: "",
  type: "rubric",
  body: "# Boundary cases\n\nTest 0 and max.",
  source_file: "boundary-cases/SKILL.md",
  ignored_files: ["boundary-cases/run.sh"],
};
const { preview, create, createReset, createState } = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  createReset: vi.fn(),
  createState: { error: null as unknown },
}));
vi.mock("../../../../lib/hooks/skills", () => ({
  usePreviewSkillImport: () => ({ mutate: preview, reset: vi.fn(), isPending: false, isError: false, error: null }),
  useCreateSkill: () => ({ mutate: create, reset: createReset, isPending: false, isError: !!createState.error, error: createState.error }),
}));

import { ImportSkillModal } from "./ImportSkillModal";

afterEach(() => {
  cleanup();
  preview.mockReset();
  create.mockReset();
  createReset.mockReset();
  createState.error = null;
});

describe("ImportSkillModal", () => {
  it("previews the upload, requires a description, and saves only on confirm", async () => {
    preview.mockImplementation((_input, opts) => opts.onSuccess(PREVIEW));
    const onImported = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ImportSkillModal onClose={vi.fn()} onImported={onImported} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Import skill" })).toBeDisabled();

    const file = new File(["zip-bytes"], "boundary-cases.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Skill file"), { target: { files: [file] } });

    await waitFor(() =>
      expect(preview).toHaveBeenCalledWith(
        { filename: "boundary-cases.zip", content_base64: btoa("zip-bytes") },
        expect.anything(),
      ),
    );
    expect(await screen.findByRole("heading", { name: "Boundary cases" })).toBeInTheDocument();
    expect(screen.getByText("boundary-cases/run.sh")).toBeInTheDocument();
    expect(screen.getByText(/someone else's instructions/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    // The archive had no description → confirm is blocked until it is filled in.
    fireEvent.click(screen.getByRole("button", { name: "Import skill" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Required.");

    fireEvent.change(screen.getByPlaceholderText(/Flag tests that only cover/), {
      target: { value: "Flag tests that skip boundary values." },
    });
    create.mockImplementation((_input, opts) => opts.onSuccess({ id: "s1" }));
    fireEvent.click(screen.getByRole("button", { name: "Import skill" }));
    expect(create).toHaveBeenCalledWith(
      {
        name: "boundary-cases",
        description: "Flag tests that skip boundary values.",
        type: "rubric",
        body: "# Boundary cases\n\nTest 0 and max.",
        source: "imported_file",
      },
      expect.anything(),
    );
    expect(onImported).toHaveBeenCalledWith({ id: "s1" });
  });
  it("shows an error and skips the preview when the file cannot be read", async () => {
    const spy = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
    });
    try {
      render(
        <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
          <ImportSkillModal onClose={vi.fn()} onImported={vi.fn()} />
        </NextIntlClientProvider>,
      );
      const file = new File(["x"], "a.md", { type: "text/markdown" });
      fireEvent.change(screen.getByLabelText("Skill file"), { target: { files: [file] } });
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not read this file.");
      expect(preview).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("does not render remote images from the untrusted file in the preview", async () => {
    preview.mockImplementation((_input, opts) =>
      opts.onSuccess({ ...PREVIEW, body: "# Title\n\n![tracker](https://tracker.example/x.png)" }),
    );
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ImportSkillModal onClose={vi.fn()} onImported={vi.fn()} />
      </NextIntlClientProvider>,
    );
    const file = new File(["x"], "a.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("Skill file"), { target: { files: [file] } });
    expect(await screen.findByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(container.ownerDocument.querySelector("img")).toBeNull();
    expect(screen.getByText(/\[image: tracker\]/)).toBeInTheDocument();
  });

  it("clears a stale create error when a new file is chosen", async () => {
    createState.error = new Error("save failed");
    preview.mockImplementation((_input, opts) => opts.onSuccess(PREVIEW));
    render(
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ImportSkillModal onClose={vi.fn()} onImported={vi.fn()} />
      </NextIntlClientProvider>,
    );
    const file = new File(["x"], "a.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("Skill file"), { target: { files: [file] } });
    await waitFor(() => expect(preview).toHaveBeenCalled());
    expect(createReset).toHaveBeenCalled();
  });
});
