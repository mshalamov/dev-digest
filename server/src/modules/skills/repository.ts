import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type SkillRow = typeof t.skills.$inferSelect;
export type SkillVersionRow = typeof t.skillVersions.$inferSelect;
export type NewSkillRow = Pick<
  typeof t.skills.$inferInsert,
  'workspaceId' | 'name' | 'description' | 'type' | 'source' | 'body' | 'enabled'
>;
export type SkillPatch = Partial<Pick<SkillRow, 'name' | 'description' | 'type' | 'body' | 'enabled'>>;

/** The only code that queries `skills` / `skill_versions`. Workspace-scoped. */
export class SkillsRepository {
  constructor(private db: Db) {}

  list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** True when another skill in the workspace already uses `name` (case-insensitive). */
  async nameTaken(workspaceId: string, name: string, exceptId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(
        and(
          eq(t.skills.workspaceId, workspaceId),
          sql`lower(${t.skills.name}) = lower(${name})`,
          ...(exceptId ? [ne(t.skills.id, exceptId)] : []),
        ),
      );
    return rows.length > 0;
  }

  /** skillId → linked agent ids (every requested id is present, possibly with []). */
  async agentIdsBySkill(skillIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map(skillIds.map((id) => [id, [] as string[]]));
    if (skillIds.length === 0) return map;
    const rows = await this.db
      .select({ skillId: t.agentSkills.skillId, agentId: t.agentSkills.agentId })
      .from(t.agentSkills)
      .where(inArray(t.agentSkills.skillId, skillIds));
    for (const r of rows) map.get(r.skillId)?.push(r.agentId);
    return map;
  }

  /** Insert at v1 and record the v1 body snapshot. */
  insert(values: NewSkillRow): Promise<SkillRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(t.skills).values({ ...values, version: 1 }).returning();
      await tx.insert(t.skillVersions).values({ skillId: row!.id, version: 1, body: row!.body });
      return row!;
    });
  }

  /** Apply a patch; a changed body bumps `version` and records a snapshot. */
  update(workspaceId: string, id: string, patch: SkillPatch): Promise<SkillRow | undefined> {
    return this.db.transaction(async (tx) => {
      const where = and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id));
      // Row lock: concurrent edits serialize here so each computes its own next version.
      const [current] = await tx.select().from(t.skills).where(where).for('update');
      if (!current) return undefined;
      const bodyChanged = patch.body !== undefined && patch.body !== current.body;
      const version = bodyChanged ? current.version + 1 : current.version;
      const [row] = await tx.update(t.skills).set({ ...patch, version }).where(where).returning();
      if (bodyChanged) await tx.insert(t.skillVersions).values({ skillId: id, version, body: patch.body! });
      return row;
    });
  }

  /** Delete (versions and agent links cascade). */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }
}
