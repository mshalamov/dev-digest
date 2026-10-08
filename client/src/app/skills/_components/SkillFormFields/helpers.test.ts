import { describe, it, expect } from "vitest";
import { validateSkillDraft, toDraft, EMPTY_DRAFT, DRAFT_LIMITS } from "./helpers";

describe("validateSkillDraft", () => {
  it("requires name, description and body (whitespace does not count)", () => {
    expect(validateSkillDraft({ ...EMPTY_DRAFT, name: "  " })).toEqual({
      name: "required",
      description: "required",
      body: "required",
    });
  });

  it("accepts a complete draft and flags over-long fields", () => {
    const ok = { name: "x", description: "Flag y.", type: "rubric" as const, body: "# z" };
    expect(validateSkillDraft(ok)).toEqual({});
    expect(validateSkillDraft({ ...ok, name: "n".repeat(DRAFT_LIMITS.name + 1) })).toEqual({ name: "tooLong" });
  });
});

describe("toDraft", () => {
  it("keeps only the editable fields", () => {
    expect(
      toDraft({
        id: "s1",
        name: "a",
        description: "b",
        type: "security",
        source: "manual",
        body: "c",
        enabled: true,
        version: 2,
      }),
    ).toEqual({ name: "a", description: "b", type: "security", body: "c" });
  });
});
