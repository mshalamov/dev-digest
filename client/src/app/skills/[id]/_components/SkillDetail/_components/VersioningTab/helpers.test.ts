import { describe, it, expect } from "vitest";
import { lineDiff, MAX_DIFF_CELLS } from "./helpers";

describe("lineDiff", () => {
  it("marks removed, added and unchanged lines from old to current", () => {
    expect(lineDiff("a\nb\nc", "a\nc\nd")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "same", text: "c" },
      { kind: "add", text: "d" },
    ]);
  });

  it("returns only unchanged lines for identical bodies", () => {
    expect(lineDiff("x\ny", "x\ny").every((l) => l.kind === "same")).toBe(true);
  });

  it("falls back to whole-body del/add when the bodies are too large", () => {
    const big = Array.from({ length: Math.ceil(Math.sqrt(MAX_DIFF_CELLS)) + 1 }, (_, i) => `l${i}`).join("\n");
    const out = lineDiff(big, big + "\nextra");
    expect(out[0]!.kind).toBe("del");
    expect(out[out.length - 1]).toEqual({ kind: "add", text: "extra" });
  });
});
