import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { previewSkillImport } from '../src/modules/skills/import.js';

const ROOT = new URL('../../docs/labs/lab_2/skills/', import.meta.url);
const FILES: Record<string, string[]> = {
  'test-quality': ['uncovered-branches', 'boundary-cases', 'excessive-mocking', 'flaky-tests'],
  'api-contract': ['breaking-change', 'response-schema', 'semver-discipline', 'deprecation-policy'],
};

describe('lab skill files', () => {
  for (const [agent, names] of Object.entries(FILES)) {
    for (const name of names) {
      it(`${agent}/${name}.md imports with a directive description and good/bad examples`, () => {
        const path = fileURLToPath(new URL(`${agent}/${name}.md`, ROOT));
        const p = previewSkillImport(`${name}.md`, readFileSync(path));
        expect(p.name).toBe(name);
        expect(p.description).toMatch(/^(Flag|Require|Treat)\b/);
        expect(['rubric', 'convention']).toContain(p.type);
        expect(p.body).toMatch(/^## Good$/m);
        expect(p.body).toMatch(/^## Bad$/m);
      });
    }
  }
});
