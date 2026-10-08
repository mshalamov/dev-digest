/* SkillCard — one skill in the Skills grid: name, type, description, version,
   agent count, enabled toggle, delete (with confirmation). Click or Enter on the
   card → preview. The confirm modal renders next to the card, not inside it, so
   it neither inherits the card's opacity nor bubbles clicks/keys into it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfirmDialog } from "../../../../components/confirm-dialog";
import { SkillTypeBadge } from "../../../../components/skill-type-badge";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onOpen,
  onToggle,
  onDelete,
  deleting,
}: {
  skill: Skill;
  active?: boolean;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const t = useTranslations("skills");
  const [confirming, setConfirming] = React.useState(false);
  const agents = skill.agent_count ?? 0;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          // Only when the card itself has focus — not Enter on the toggle or trash button.
          if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
        }}
        style={s.card(!!active, skill.enabled)}
      >
        <div style={s.head}>
          <Icon.Sparkles size={15} />
          <span className="mono" style={s.name}>
            {skill.name}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
          <button
            type="button"
            aria-label={t("card.delete")}
            title={t("card.delete")}
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            style={s.iconBtn}
          >
            <Icon.Trash size={14} />
          </button>
        </div>
        <div style={s.description}>{skill.description || t("card.noDescription")}</div>
        <div style={s.meta}>
          <SkillTypeBadge type={skill.type} />
          <span className="mono">{t("card.version", { version: skill.version })}</span>
          <span>{t("card.agentCount", { count: agents })}</span>
          {skill.source === "imported_file" && <Badge icon="Upload">{t("source.imported_file")}</Badge>}
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t("card.deleteTitle")}
          body={t("card.deleteBody", { name: skill.name, count: agents })}
          confirmLabel={t("card.deleteConfirm")}
          cancelLabel={t("card.cancel")}
          pending={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onDelete();
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}
