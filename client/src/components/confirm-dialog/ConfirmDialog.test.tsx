import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("confirms, cancels, and closes with the X", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Delete skill?"
        body="It is linked to 2 agents."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("Delete skill?")).toBeInTheDocument();
    expect(screen.getByText("It is linked to 2 agents.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
