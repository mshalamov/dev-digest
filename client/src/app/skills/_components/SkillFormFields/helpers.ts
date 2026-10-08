import type { Skill } from "@devdigest/shared";
import type { SkillDraft } from "../../../../lib/hooks/skills";
import { DRAFT_LIMITS } from "./constants";

export { DRAFT_LIMITS };

export type SkillDraftErrors = Partial<Record<"name" | "description" | "body", "required" | "tooLong">>;

export const EMPTY_DRAFT: SkillDraft = { name: "", description: "", type: "custom", body: "" };

export function toDraft(skill: Skill): SkillDraft {
  return { name: skill.name, description: skill.description, type: skill.type, body: skill.body };
}

export function validateSkillDraft(draft: SkillDraft): SkillDraftErrors {
  const errors: SkillDraftErrors = {};
  for (const key of ["name", "description", "body"] as const) {
    const value = draft[key].trim();
    if (!value) errors[key] = "required";
    else if (value.length > DRAFT_LIMITS[key]) errors[key] = "tooLong";
  }
  return errors;
}
