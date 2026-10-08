/* SkillFormFields — name, directive description, type, markdown body.
   Shared by the create modal, the import preview and the skill Config tab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import type { SkillDraft } from "../../../../lib/hooks/skills";
import { SKILL_TYPES } from "./constants";
import type { SkillDraftErrors } from "./helpers";

export function SkillFormFields({
  value,
  onChange,
  errors = {},
}: {
  value: SkillDraft;
  onChange: (draft: SkillDraft) => void;
  errors?: SkillDraftErrors;
}) {
  const t = useTranslations("skills");
  const set =
    <K extends keyof SkillDraft>(key: K) =>
    (v: SkillDraft[K]) =>
      onChange({ ...value, [key]: v });
  const hint = (key: keyof SkillDraftErrors, fallback: string) =>
    errors[key] ? (
      <span role="alert" style={{ color: "var(--danger, #f85149)" }}>
        {t(`form.errors.${errors[key]}`)}
      </span>
    ) : (
      fallback
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FormField label={t("form.name")} required hint={hint("name", t("form.nameHint"))}>
        <TextInput mono value={value.name} onChange={set("name")} placeholder={t("form.namePlaceholder")} />
      </FormField>
      <FormField label={t("form.description")} required hint={hint("description", t("form.descriptionHint"))}>
        <TextInput
          value={value.description}
          onChange={set("description")}
          placeholder={t("form.descriptionPlaceholder")}
        />
      </FormField>
      <FormField label={t("form.type")}>
        <SelectInput
          value={value.type}
          onChange={(v) => set("type")(v as SkillType)}
          options={SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
        />
      </FormField>
      <FormField label={t("form.body")} required hint={hint("body", t("form.bodyHint"))}>
        <Textarea mono rows={14} value={value.body} onChange={set("body")} placeholder={t("form.bodyPlaceholder")} />
      </FormField>
    </div>
  );
}
