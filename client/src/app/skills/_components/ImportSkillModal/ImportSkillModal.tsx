/* ImportSkillModal — upload .md / .zip → server-side parse → editable preview
   → explicit confirm. Nothing is saved before "Import skill"; the saved skill
   starts disabled (server default for imported_file). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Markdown, Modal, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useCreateSkill, usePreviewSkillImport, type SkillDraft } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { SkillFormFields, validateSkillDraft } from "../SkillFormFields";
import { fileToBase64, stripImages } from "./helpers";

interface SourceInfo {
  source_file: string;
  ignored_files: string[];
}

export function ImportSkillModal({ onClose, onImported }: { onClose: () => void; onImported: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const preview = usePreviewSkillImport();
  const create = useCreateSkill();
  const [draft, setDraft] = React.useState<SkillDraft | null>(null);
  const [source, setSource] = React.useState<SourceInfo | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [readError, setReadError] = React.useState(false);
  const errors = draft ? validateSkillDraft(draft) : {};

  const onFile = async (file: File) => {
    setDraft(null);
    setSource(null);
    setSubmitted(false);
    setReadError(false);
    preview.reset();
    create.reset();
    let content_base64: string;
    try {
      content_base64 = await fileToBase64(file);
    } catch {
      setReadError(true);
      return;
    }
    preview.mutate(
      { filename: file.name, content_base64 },
      {
        onSuccess: (p) => {
          setDraft({ name: p.name, description: p.description, type: p.type, body: p.body });
          setSource({ source_file: p.source_file, ignored_files: p.ignored_files });
        },
      },
    );
  };

  const confirm = () => {
    if (!draft) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    create.mutate({ ...draft, source: "imported_file" }, { onSuccess: onImported });
  };

  const failure = readError || preview.error || create.error;
  return (
    <Modal
      width={820}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button kind="secondary" onClick={onClose}>
            {t("import.cancel")}
          </Button>
          <Button kind="primary" disabled={!draft} loading={create.isPending} onClick={confirm}>
            {t("import.confirm")}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <input
            type="file"
            accept=".md,.markdown,.zip"
            aria-label={t("import.fileLabel")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
              e.target.value = "";
            }}
          />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{t("import.fileHint")}</div>
        </div>

        {preview.isPending && <Skeleton height={120} />}
        {failure && (
          <div role="alert" style={{ color: "var(--danger, #f85149)", fontSize: 13 }}>
            {failure instanceof ApiError ? failure.message : t("import.failed")}
          </div>
        )}

        {draft && source && (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 12.5,
              }}
            >
              <Icon.Shield size={14} />
              <span>{t("import.trustNotice")}</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("import.sourceFile", { file: source.source_file })}
            </div>
            {source.ignored_files.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {t("import.ignored", { count: source.ignored_files.length })}
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {source.ignored_files.map((f) => (
                    <li key={f} className="mono">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SkillFormFields value={draft} onChange={setDraft} errors={submitted ? errors : {}} />
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("import.rendered")}</div>
            <div style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
              <Markdown>{stripImages(draft.body)}</Markdown>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
