/* SkillDetail — tabs for one skill: Config, Preview, Versioning. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersioningTab } from "./_components/VersioningTab";
import { TABS } from "./constants";

export function SkillDetail({ skill, tab, onTab }: { skill: Skill; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("skills");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      {/* Config stays mounted (hidden) on other tabs so unsaved edits survive a tab switch.
          Keyed per skill so the form starts from that skill's fields. */}
      <div hidden={tab === "preview" || tab === "versioning"}>
        <ConfigTab key={skill.id} skill={skill} />
      </div>
      {tab === "preview" && <PreviewTab skill={skill} />}
      {tab === "versioning" && <VersioningTab skill={skill} />}
    </div>
  );
}
