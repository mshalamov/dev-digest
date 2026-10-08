/* CreateSkillModal — write a new skill from scratch. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useCreateSkill, type SkillDraft } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { EMPTY_DRAFT, SkillFormFields, validateSkillDraft } from "../SkillFormFields";

export function CreateSkillModal({ onClose, onCreated }: { onClose: () => void; onCreated: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [draft, setDraft] = React.useState<SkillDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = React.useState(false);
  const errors = validateSkillDraft(draft);

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    create.mutate(draft, { onSuccess: onCreated });
  };

  return (
    <Modal
      width={720}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button kind="secondary" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" loading={create.isPending} onClick={submit}>
            {t("create.submit")}
          </Button>
        </div>
      }
    >
      <SkillFormFields value={draft} onChange={setDraft} errors={submitted ? errors : {}} />
      {create.isError && (
        <div role="alert" style={{ marginTop: 12, color: "var(--danger, #f85149)", fontSize: 13 }}>
          {create.error instanceof ApiError ? create.error.message : t("create.failed")}
        </div>
      )}
    </Modal>
  );
}
