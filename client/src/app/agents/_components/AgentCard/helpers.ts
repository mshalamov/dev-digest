import type { Skill } from "@devdigest/shared";
import { MODEL_COLOR } from "./constants";

/** Resolve the chip colour for an agent's model (unknown → secondary token). */
export function modelColor(model: string): string {
  return MODEL_COLOR[model] ?? "var(--text-secondary)";
}

/** Skills linked to `agentId`; undefined while the skills list is loading. */
export function skillCountFor(agentId: string, skills: Skill[] | undefined): number | undefined {
  if (!skills) return undefined;
  return skills.filter((s) => s.agent_ids?.includes(agentId)).length;
}
