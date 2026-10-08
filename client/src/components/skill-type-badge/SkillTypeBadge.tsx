/* SkillTypeBadge — coloured type label (rubric / convention / security / custom).
   Shared by the Skills pages and the agent editor's Skills tab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

/** Type label colours, as in the Skills tab mockup. */
const TYPE_COLORS: Record<SkillType, string> = {
  rubric: "var(--accent)",
  convention: "var(--success, #3fb950)",
  security: "var(--danger, #f85149)",
  custom: "var(--text-secondary)",
};

export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  return <Badge color={TYPE_COLORS[type]}>{t(`type.${type}`)}</Badge>;
}
