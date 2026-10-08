/* SkillsListView — the Skills Lab grid: search, cards (toggle / delete),
   and a side preview panel for the selected skill. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Skeleton, TextInput } from "@devdigest/ui";
import { useDeleteSkill, useSkills, useUpdateSkill } from "../../../../lib/hooks/skills";
import { CreateSkillModal } from "../CreateSkillModal";
import { ImportSkillModal } from "../ImportSkillModal";
import { SkillCard } from "../SkillCard";
import { SkillPreviewPanel } from "../SkillPreviewPanel";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsListView() {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"create" | "import" | null>(null);
  const onSaved = (skill: { id: string }) => {
    setMode(null);
    setOpenId(skill.id);
  };

  const all = data ?? [];
  const list = filterSkills(all, query);
  const open = all.find((sk) => sk.id === openId) ?? null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.titleBlock}>
          <h1 style={s.title}>{t("page.heading")}</h1>
          <p style={s.subtitle}>{t("page.subtitle")}</p>
        </div>
        <Dropdown
          width={260}
          align="right"
          trigger={
            <Button kind="primary" icon="Plus">
              {t("page.add")}
            </Button>
          }
          items={[
            { label: t("page.addCreate"), icon: "Edit", onClick: () => setMode("create") },
            { label: t("page.addImport"), icon: "Upload", onClick: () => setMode("import") },
          ]}
        />
      </div>
      <div style={s.search}>
        <TextInput value={query} onChange={setQuery} placeholder={t("page.searchPlaceholder")} />
      </div>

      {isLoading && (
        <div style={s.grid}>
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      )}
      {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
      {!isLoading && !isError && all.length === 0 && (
        <EmptyState icon="Sparkles" title={t("page.empty.title")} body={t("page.empty.body")}
          cta={t("page.addCreate")}
          onCta={() => setMode("create")}
        />
      )}
      {del.isError && (
        <div role="alert" style={{ ...s.noMatch, color: "var(--danger, #f85149)" }}>
          {t("page.deleteFailed")}
        </div>
      )}
      {all.length > 0 && list.length === 0 && <div style={s.noMatch}>{t("page.noMatch", { q: query })}</div>}
      {list.length > 0 && (
        <div style={s.grid}>
          {list.map((sk) => (
            <SkillCard
              key={sk.id}
              skill={sk}
              active={sk.id === openId}
              onOpen={() => setOpenId(sk.id)}
              onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              onDelete={() => {
                del.mutate(sk.id);
                if (openId === sk.id) setOpenId(null);
              }}
              deleting={del.isPending && del.variables === sk.id}
            />
          ))}
        </div>
      )}

      {mode === "create" && <CreateSkillModal onClose={() => setMode(null)} onCreated={onSaved} />}
      {mode === "import" && <ImportSkillModal onClose={() => setMode(null)} onImported={onSaved} />}
      {open && <SkillPreviewPanel skill={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
