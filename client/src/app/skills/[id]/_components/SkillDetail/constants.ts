import type { IconName } from "@devdigest/ui";

export interface DetailTab {
  key: "config" | "preview" | "versioning";
  labelKey: string;
  icon: IconName;
}

/** Skill page tabs (#25). Stats is a later lesson. */
export const TABS: readonly DetailTab[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "versioning", labelKey: "detail.tabs.versioning", icon: "History" },
];

export const VALID_TABS: readonly string[] = TABS.map((tb) => tb.key);
