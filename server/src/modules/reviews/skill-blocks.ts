/**
 * Skills → prompt blocks (pure). The caller passes the agent's linked skills in
 * `agent_skills.order`; globally disabled skills are dropped here, so a disabled
 * skill never reaches the prompt or the run log.
 */
export interface PromptSkill {
  name: string;
  description: string;
  body: string;
  enabled: boolean;
}

export interface SkillBlock {
  name: string;
  text: string;
}

export function formatSkillBlock(skill: Pick<PromptSkill, 'name' | 'description' | 'body'>): string {
  const description = skill.description.trim();
  return [`### Skill: ${skill.name}`, description ? `> ${description}` : null, skill.body.trim()]
    .filter((part): part is string => part !== null)
    .join('\n\n');
}

export function toSkillBlocks(linked: readonly PromptSkill[]): SkillBlock[] {
  return linked.filter((s) => s.enabled).map((s) => ({ name: s.name, text: formatSkillBlock(s) }));
}
