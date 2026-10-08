import type { Container } from '../../platform/container.js';
import type { Skill, SkillImportPreview, SkillType, SkillVersion } from '@devdigest/shared';
import { ValidationError } from '../../platform/errors.js';
import { SkillsRepository, type SkillPatch } from './repository.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';
import { previewSkillImport } from './import.js';

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: 'manual' | 'imported_file';
  enabled?: boolean;
}

/**
 * Skills service — the Skills Lab use cases. Imported skills start disabled:
 * enabling one is the user's decision to trust its instructions in a prompt.
 */
export class SkillsService {
  private repo: SkillsRepository;

  constructor(container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    const links = await this.repo.agentIdsBySkill(rows.map((r) => r.id));
    return rows.map((r) => toSkillDto(r, links.get(r.id)));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const links = await this.repo.agentIdsBySkill([id]);
    return toSkillDto(row, links.get(id));
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    await this.assertNameFree(workspaceId, input.name);
    const source = input.source ?? 'manual';
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source,
      body: input.body,
      enabled: input.enabled ?? source !== 'imported_file',
    });
    return toSkillDto(row);
  }

  async update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill | undefined> {
    if (patch.name !== undefined) await this.assertNameFree(workspaceId, patch.name, id);
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? this.get(workspaceId, id) : undefined;
  }

  delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    if (!(await this.repo.getById(workspaceId, id))) return undefined;
    return (await this.repo.listVersions(id)).map(toSkillVersionDto);
  }

  /** Save `version`'s body as a NEW version; history is never rewritten. */
  async restore(workspaceId: string, id: string, version: number): Promise<Skill | undefined> {
    if (!(await this.repo.getById(workspaceId, id))) return undefined;
    const snapshot = await this.repo.getVersion(id, version);
    if (!snapshot) return undefined;
    return this.update(workspaceId, id, { body: snapshot.body });
  }

  previewImport(filename: string, contentBase64: string): SkillImportPreview {
    return previewSkillImport(filename, Buffer.from(contentBase64, 'base64'));
  }

  private async assertNameFree(workspaceId: string, name: string, exceptId?: string): Promise<void> {
    if (await this.repo.nameTaken(workspaceId, name, exceptId)) {
      throw new ValidationError(`A skill named "${name}" already exists`);
    }
  }
}
