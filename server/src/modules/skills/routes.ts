import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';

/**
 * skills module (Skills Lab).
 *   GET    /skills                                 → list (+ agent_ids / agent_count)
 *   GET    /skills/:id                             → one skill
 *   POST   /skills                                 → create (manual or confirmed import)
 *   PUT    /skills/:id                             → edit / toggle (body edit = new version)
 *   DELETE /skills/:id                             → delete (links + versions cascade)
 *   GET    /skills/:id/versions                    → body history, newest first
 *   POST   /skills/:id/versions/:version/restore   → save that body as a new version
 *   POST   /skills/import/preview                  → parse .md/.zip; nothing is saved
 */

const Fields = {
  // One line: the name becomes the `### Skill: <name>` header in the prompt.
  name: z.string().trim().min(1).max(80).regex(/^[^\r\n]+$/, 'Name must be a single line'),
  description: z.string().trim().min(1).max(500),
  type: SkillType,
  body: z.string().trim().min(1).max(50_000),
};

const CreateSkillBody = z.object({
  ...Fields,
  source: z.enum(['manual', 'imported_file']).optional(),
  enabled: z.boolean().optional(),
});

const UpdateSkillBody = z.object({
  name: Fields.name.optional(),
  description: Fields.description.optional(),
  type: Fields.type.optional(),
  body: Fields.body.optional(),
  enabled: z.boolean().optional(),
});

const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

const ImportPreviewBody = z.object({
  filename: z.string().min(1).max(255),
  content_base64: z.string().min(1),
});

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    if (!(await service.delete(workspaceId, req.params.id))) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.post(
    '/skills/:id/versions/:version/restore',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.restore(workspaceId, req.params.id, req.params.version);
      if (!skill) throw new NotFoundError('Skill version not found');
      return skill;
    },
  );

  app.post('/skills/import/preview', { schema: { body: ImportPreviewBody } }, async (req) => {
    await getContext(app.container, req);
    return service.previewImport(req.body.filename, req.body.content_base64);
  });
}
