/* ConfigTab — edit name / description / type / body, and the enabled toggle. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill, type SkillDraft } from "../../../../../../../lib/hooks/skills";
import { ApiError } from "../../../../../../../lib/api";
import { SkillFormFields, toDraft, validateSkillDraft } from "../../../../../_components/SkillFormFields";

const sameDraft = (a: SkillDraft, b: SkillDraft) =>
  a.name === b.name && a.description === b.description && a.type === b.type && a.body === b.body;

export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const update = useUpdateSkill();
  const [draft, setDraft] = React.useState<SkillDraft>(() => toDraft(skill));
  const [submitted, setSubmitted] = React.useState(false);
  const [savedVersion, setSavedVersion] = React.useState<number | null>(null);
  const errors = validateSkillDraft(draft);
  const dirty = !sameDraft(draft, toDraft(skill));

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    update.mutate(
      { id: skill.id, patch: draft },
      {
        onSuccess: (saved) => {
          setDraft(toDraft(saved));
          setSavedVersion(saved.version);
          setSubmitted(false);
        },
      },
    );
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 16 }}>
      <FormField label={t("config.enabled")} hint={t("config.enabledHint")}>
        <Toggle on={skill.enabled} onChange={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })} />
      </FormField>
      <SkillFormFields value={draft} onChange={setDraft} errors={submitted ? errors : {}} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button kind="primary" disabled={!dirty} loading={update.isPending} onClick={save}>
          {t("config.save")}
        </Button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {savedVersion != null && !dirty ? t("config.saved", { version: savedVersion }) : t("config.versionHint")}
        </span>
      </div>
      {update.isError && (
        <div role="alert" style={{ color: "var(--danger, #f85149)", fontSize: 13 }}>
          {update.error instanceof ApiError ? update.error.message : t("config.failed")}
        </div>
      )}
    </div>
  );
}
