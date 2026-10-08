/* SkillPreviewPanel — right-hand side panel with a skill's rendered body. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge, Button, Drawer, Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "../../../../components/skill-type-badge";

export function SkillPreviewPanel({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  return (
    <Drawer
      width={560}
      title={<span className="mono">{skill.name}</span>}
      subtitle={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <SkillTypeBadge type={skill.type} />
          <span className="mono">{t("card.version", { version: skill.version })}</span>
          <span>{t("card.agentCount", { count: skill.agent_count ?? 0 })}</span>
        </span>
      }
      onClose={onClose}
      footer={
        <Button kind="primary" icon="ExternalLink" onClick={() => router.push(`/skills/${skill.id}`)}>
          {t("panel.open")}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!skill.enabled && <Badge color="var(--text-muted)">{t("panel.disabled")}</Badge>}
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{t("panel.description")}</div>
          <div style={{ fontSize: 13 }}>{skill.description || t("card.noDescription")}</div>
        </div>
        <Markdown>{skill.body}</Markdown>
      </div>
    </Drawer>
  );
}
