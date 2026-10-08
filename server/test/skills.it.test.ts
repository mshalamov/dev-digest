import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { AgentsRepository } from '../src/modules/agents/repository.js';
import { zipSync, strToU8 } from 'fflate';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

let seq = 0;
const draft = (over: Record<string, unknown> = {}) => ({
  name: `skill-${++seq}`,
  description: 'Flag tests that only cover the happy path.',
  type: 'rubric',
  body: '# Rule\nCover the error branch.',
  ...over,
});

d('skills module (Testcontainers pg)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  it('creates a manual skill at v1 and persists it in Postgres', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'happy-path' }) });
    expect(res.statusCode).toBe(201);
    const skill = res.json();
    expect(skill).toMatchObject({ name: 'happy-path', source: 'manual', enabled: true, version: 1, agent_count: 0 });

    const [row] = await pg.handle.db.select().from(t.skills).where(eq(t.skills.id, skill.id));
    expect(row?.body).toBe('# Rule\nCover the error branch.');
    const versions = await pg.handle.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, skill.id));
    expect(versions.map((v) => v.version)).toEqual([1]);

    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.some((s: { id: string }) => s.id === skill.id)).toBe(true);
    await app.close();
  });

  it('a body edit bumps the version; a rename or toggle does not', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;

    const renamed = (await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { name: `renamed-${seq}`, enabled: false } })).json();
    expect(renamed).toMatchObject({ version: 1, enabled: false });

    const edited = (await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: '# Rule v2' } })).json();
    expect(edited).toMatchObject({ version: 2, body: '# Rule v2' });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[1].body).toBe('# Rule\nCover the error branch.');
    await app.close();
  });

  it('restore saves the old body as a new version', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: '# Changed' } });

    const restored = await app.inject({ method: 'POST', url: `/skills/${id}/versions/1/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ version: 3, body: '# Rule\nCover the error branch.' });

    const missing = await app.inject({ method: 'POST', url: `/skills/${id}/versions/99/restore` });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('concurrent body edits each get their own version', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;

    const results = await Promise.all([
      app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: '# A' } }),
      app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: '# B' } }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    await app.close();
  });

  it('reports agent links and drops them when the skill is deleted', async () => {
    const app = await makeApp();
    const skillId = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `Agent ${seq}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review.' },
      })
    ).json().id;
    await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_ids: [skillId] } });

    const linked = (await app.inject({ method: 'GET', url: `/skills/${skillId}` })).json();
    expect(linked).toMatchObject({ agent_count: 1, agent_ids: [agentId] });

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    expect(del.json()).toEqual({ ok: true });
    expect((await app.inject({ method: 'GET', url: `/skills/${skillId}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json()).toEqual([]);
    await app.close();
  });

  it('setSkills is atomic: a failed insert keeps the existing links', async () => {
    const app = await makeApp();
    const skillId = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `Agent ${seq}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review.' },
      })
    ).json().id;
    await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_ids: [skillId] } });

    const repo = new AgentsRepository(pg.handle.db);
    await expect(repo.setSkills(agentId, [skillId, randomUUID()])).rejects.toThrow();
    expect((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json()).toHaveLength(1);
    await app.close();
  });

  it('a row deleted directly in Postgres disappears from GET /skills', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    await pg.handle.db.delete(t.skills).where(eq(t.skills.id, id));
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.some((s: { id: string }) => s.id === id)).toBe(false);
    await app.close();
  });

  it('validates input (incl. single-line names) and rejects duplicate names (case-insensitive)', async () => {
    const app = await makeApp();
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: '' }) })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ type: 'wizardry' }) })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ description: ' ' }) })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'two\nlines' }) })).statusCode).toBe(422);

    await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'Unique-Name' }) });
    const dup = await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'unique-name' }) });
    expect(dup.statusCode).toBe(422);
    expect(dup.json().error.message).toMatch(/already exists/);

    const other = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json();
    const clash = await app.inject({ method: 'PUT', url: `/skills/${other.id}`, payload: { name: 'UNIQUE-NAME' } });
    expect(clash.statusCode).toBe(422);
    await app.close();
  });

  it('returns 404 for unknown skills', async () => {
    const app = await makeApp();
    const id = '00000000-0000-4000-8000-000000000000';
    for (const [method, url] of [
      ['GET', `/skills/${id}`],
      ['PUT', `/skills/${id}`],
      ['DELETE', `/skills/${id}`],
      ['GET', `/skills/${id}/versions`],
      ['POST', `/skills/${id}/versions/1/restore`],
    ] as const) {
      const res = await app.inject({ method, url, ...(method === 'PUT' ? { payload: { enabled: true } } : {}) });
      expect(res.statusCode, `${method} ${url}`).toBe(404);
    }
    await app.close();
  });

  it('previews an import without saving, then saves it disabled as imported_file', async () => {
    const app = await makeApp();
    const before = (await app.inject({ method: 'GET', url: '/skills' })).json().length;
    const zip = zipSync({
      'edge-skill/SKILL.md': strToU8('---\nname: edge-skill\ndescription: Flag missing edge cases.\ntype: rubric\n---\n# Edge\nTest 0 and max.'),
      'edge-skill/run.sh': strToU8('#!/bin/sh\necho pwned'),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'edge-skill.zip', content_base64: Buffer.from(zip).toString('base64') },
    });
    expect(res.statusCode).toBe(200);
    const preview = res.json();
    expect(preview).toMatchObject({ name: 'edge-skill', type: 'rubric', ignored_files: ['edge-skill/run.sh'] });
    expect((await app.inject({ method: 'GET', url: '/skills' })).json()).toHaveLength(before);

    const saved = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name: preview.name, description: preview.description, type: preview.type, body: preview.body, source: 'imported_file' },
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toMatchObject({ source: 'imported_file', enabled: false, version: 1 });
    await app.close();
  });

  it('rejects an upload that is not a skill', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'tool.exe', content_base64: Buffer.from('MZ').toString('base64') },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });
  it('rejects unknown skill ids on an agent and de-duplicates repeats', async () => {
    const app = await makeApp();
    const skillId = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `Linker ${seq}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review.' },
      })
    ).json().id;

    const unknown = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: ['00000000-0000-4000-8000-000000000000'] },
    });
    expect(unknown.statusCode).toBe(422);
    const unknownOne = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: '00000000-0000-4000-8000-000000000000' },
    });
    expect(unknownOne.statusCode).toBe(422);

    const dup = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [skillId, skillId] },
    });
    expect(dup.statusCode).toBe(200);
    expect(dup.json()).toEqual([{ agent_id: agentId, skill_id: skillId, order: 0 }]);
    await app.close();
  });
});
