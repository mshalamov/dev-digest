import type { Skill } from "@devdigest/shared";

export interface SkillRow {
  skill: Skill;
  linked: boolean;
}

/** Linked skills first in prompt (link) order, then unlinked by name. */
export function orderRows(skills: Skill[], linkedIds: string[]): SkillRow[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const linked = linkedIds
    .map((id) => byId.get(id))
    .filter((sk): sk is Skill => sk !== undefined)
    .map((skill) => ({ skill, linked: true }));
  const rest = skills
    .filter((sk) => !linkedIds.includes(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, linked: false }));
  return [...linked, ...rest];
}

export function filterRows(rows: SkillRow[], query: string): SkillRow[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.skill.name.toLowerCase().includes(q)) : rows;
}

/** Link (append once) or unlink a skill id. */
export function toggleId(ids: string[], id: string, on: boolean): string[] {
  if (!on) return ids.filter((x) => x !== id);
  return ids.includes(id) ? ids : [...ids, id];
}

/** Move `fromId` to `toId`'s position; unknown ids leave the order unchanged. */
export function moveId(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}
