import { describe, it, expect } from "vitest";
import { SEVERITIES, countBySeverity, filterBySeverity, toggleSeverity } from "./severity";

const f = (severity: string, id: string = severity) => ({ id, severity });

describe("countBySeverity", () => {
  it("groups by severity and reports 0 for absent levels", () => {
    expect(countBySeverity([f("CRITICAL", "a"), f("CRITICAL", "b"), f("SUGGESTION")])).toEqual({
      CRITICAL: 2,
      WARNING: 0,
      SUGGESTION: 1,
    });
  });
  it("ignores unknown severities (free-text DB column) instead of adding a bucket", () => {
    expect(countBySeverity([f("INFO"), f("toString"), f("critical")])).toEqual({
      CRITICAL: 0,
      WARNING: 0,
      SUGGESTION: 0,
    });
  });
});

describe("filterBySeverity", () => {
  const items = [f("CRITICAL", "c"), f("WARNING", "w1"), f("WARNING", "w2")];
  it("null keeps everything, as a new array", () => {
    const out = filterBySeverity(items, null);
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });
  it("a severity keeps only that level", () => {
    expect(filterBySeverity(items, "WARNING").map((x) => x.id)).toEqual(["w1", "w2"]);
    expect(filterBySeverity(items, "SUGGESTION")).toEqual([]);
  });
});

describe("toggleSeverity", () => {
  it("selects, switches, and clears on a second click on the same level", () => {
    expect(toggleSeverity(null, "WARNING")).toBe("WARNING");
    expect(toggleSeverity("WARNING", "CRITICAL")).toBe("CRITICAL");
    expect(toggleSeverity("WARNING", "WARNING")).toBeNull();
  });
});

it("SEVERITIES is ordered most severe first", () => {
  expect(SEVERITIES).toEqual(["CRITICAL", "WARNING", "SUGGESTION"]);
});
