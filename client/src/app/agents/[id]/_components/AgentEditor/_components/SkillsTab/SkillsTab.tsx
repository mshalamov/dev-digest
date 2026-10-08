/* SkillsTab — every workspace skill with a toggle (link to this agent), a type
   label and a name filter. Linked skills come first in prompt order and are the
   only draggable rows; dropping one on another saves the new order. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, ErrorState, Icon, Skeleton, TextInput } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/agents";
import { useSkills } from "../../../../../../../lib/hooks/skills";
import { SkillTypeBadge } from "../../../../../../../components/skill-type-badge";
import { filterRows, moveId, orderRows, toggleId } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const skills = useSkills();
  const links = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();
  const [query, setQuery] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);

  if (skills.isLoading || links.isLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={200} />
      </div>
    );
  }
  if (skills.isError || links.isError) {
    return (
      <div style={s.wrap}>
        <ErrorState
          body={t("skills.loadError")}
          onRetry={() => {
            void skills.refetch();
            void links.refetch();
          }}
        />
      </div>
    );
  }

  const all = skills.data ?? [];
  const linkedIds = [...(links.data ?? [])].sort((a, b) => a.order - b.order).map((l) => l.skill_id);
  const rows = filterRows(orderRows(all, linkedIds), query);
  const save = (ids: string[]) => setSkills.mutate({ agentId: agent.id, skillIds: ids });

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>{t("skills.title")}</h2>
        <Badge color="var(--accent)">{t("skills.enabledCount", { linked: linkedIds.length, total: all.length })}</Badge>
        <div style={s.filter}>
          <TextInput value={query} onChange={setQuery} placeholder={t("skills.filterPlaceholder")} />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>
      {all.length === 0 && <p style={s.hint}>{t("skills.empty")}</p>}
      <div style={s.list}>
        {rows.map(({ skill, linked }) => (
          <div
            key={skill.id}
            draggable={linked}
            onDragStart={
              linked
                ? (e) => {
                    // Firefox only starts a drag when dragstart puts data on it.
                    e.dataTransfer?.setData("text/plain", skill.id);
                    setDragId(skill.id);
                  }
                : undefined
            }
            onDragOver={(e) => {
              if (linked && dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (linked && dragId) save(moveId(linkedIds, dragId, skill.id));
              setDragId(null);
            }}
            onDragEnd={() => setDragId(null)}
            style={s.row(linked, dragId === skill.id)}
          >
            <span style={s.handle(linked)} aria-hidden="true">
              <Icon.Menu size={14} />
            </span>
            <Checkbox checked={linked} onChange={(on) => save(toggleId(linkedIds, skill.id, on))} />
            <span className="mono" style={s.name}>
              {skill.name}
            </span>
            {!skill.enabled && <Badge color="var(--text-muted)">{t("skills.globallyDisabled")}</Badge>}
            <SkillTypeBadge type={skill.type} />
          </div>
        ))}
      </div>
      {setSkills.isError && (
        <div role="alert" style={s.error}>
          {t("skills.saveError")}
        </div>
      )}
    </div>
  );
}
