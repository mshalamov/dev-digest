import { describe, it, expect } from 'vitest';
import { formatSkillBlock, toSkillBlocks } from '../src/modules/reviews/skill-blocks.js';

const skill = (name: string, enabled = true) => ({
  name,
  description: `Flag ${name} problems.`,
  body: `Rules for ${name}.`,
  enabled,
});

describe('skill blocks', () => {
  it('formats one block with a header, the description and the body', () => {
    expect(formatSkillBlock(skill('boundary-cases'))).toBe(
      '### Skill: boundary-cases\n\n> Flag boundary-cases problems.\n\nRules for boundary-cases.',
    );
  });

  it('keeps link order and drops globally disabled skills', () => {
    const blocks = toSkillBlocks([skill('beta'), skill('gamma', false), skill('alpha')]);
    expect(blocks.map((b) => b.name)).toEqual(['beta', 'alpha']);
    expect(blocks[0]!.text.startsWith('### Skill: beta')).toBe(true);
  });

  it('omits an empty description line', () => {
    expect(formatSkillBlock({ name: 'x', description: '  ', body: 'b' })).toBe('### Skill: x\n\nb');
  });

  it('returns no blocks when nothing is linked', () => {
    expect(toSkillBlocks([])).toEqual([]);
  });
});
