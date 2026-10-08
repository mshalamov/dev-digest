/* /skills — Skills Lab: the skills grid. Thin page: shell + view. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "../../components/app-shell";
import { SkillsListView } from "./_components/SkillsListView";

export default function SkillsPage() {
  const t = useTranslations("skills");
  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.heading") }]}>
      <SkillsListView />
    </AppShell>
  );
}
