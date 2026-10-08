import { describe, it, expect } from "vitest";
import { NAV } from "@devdigest/ui";

describe("sidebar nav", () => {
  it("lists Skills and Agents under SKILLS LAB, not WORKSPACE", () => {
    const lab = NAV.find((g) => g.section === "SKILLS LAB");
    expect(lab?.items.map((i) => [i.key, i.href])).toEqual([
      ["skills", "/skills"],
      ["agents", "/agents"],
    ]);
    const workspace = NAV.find((g) => g.section === "WORKSPACE");
    expect(workspace?.items.map((i) => i.key)).not.toContain("agents");
  });
});
