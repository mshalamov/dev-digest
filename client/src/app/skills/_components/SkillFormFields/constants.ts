import type { SkillType } from "@devdigest/shared";

export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Same limits as the server's request schema (server/src/modules/skills/routes.ts). */
export const DRAFT_LIMITS = { name: 80, description: 500, body: 50_000 } as const;
