import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { filterRows, moveId, orderRows, toggleId } from "./helpers";

const mk = (id: string, name: string): Skill => ({
  id,
  name,
  description: "d",
  type: "custom",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
});

describe("SkillsTab helpers", () => {
  const skills = [mk("s1", "charlie"), mk("s2", "alpha"), mk("s3", "bravo")];

  it("orders linked skills first (link order), then the rest by name", () => {
    expect(orderRows(skills, ["s3", "s1"]).map((r) => [r.skill.name, r.linked])).toEqual([
      ["bravo", true],
      ["charlie", true],
      ["alpha", false],
    ]);
  });

  it("ignores link ids whose skill no longer exists", () => {
    expect(orderRows(skills, ["gone", "s2"]).map((r) => r.skill.id)).toEqual(["s2", "s3", "s1"]);
  });

  it("filters by name, case-insensitively", () => {
    expect(filterRows(orderRows(skills, []), " ALP ").map((r) => r.skill.id)).toEqual(["s2"]);
  });

  it("toggles an id on (appended once) and off", () => {
    expect(toggleId(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a", false)).toEqual(["b"]);
  });

  it("moves an id to another id's position", () => {
    expect(moveId(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveId(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveId(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
});
