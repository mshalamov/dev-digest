import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { skillCountFor } from "./helpers";

const skill = (id: string, agent_ids: string[]): Skill => ({
  id,
  name: id,
  description: "d",
  type: "rubric",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  agent_ids,
  agent_count: agent_ids.length,
});

describe("skillCountFor", () => {
  it("counts the skills linked to one agent", () => {
    const skills = [skill("s1", ["a1", "a2"]), skill("s2", ["a2"]), skill("s3", [])];
    expect(skillCountFor("a2", skills)).toBe(2);
    expect(skillCountFor("a1", skills)).toBe(1);
    expect(skillCountFor("a9", skills)).toBe(0);
  });

  it("is undefined while skills are loading", () => {
    expect(skillCountFor("a1", undefined)).toBeUndefined();
  });
});
