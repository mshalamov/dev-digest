/* VersioningTab — body history: Diff (old → current) and Restore per version. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "../../../../../../../lib/hooks/skills";
import { ApiError } from "../../../../../../../lib/api";
import { lineDiff, type DiffLine } from "./helpers";

const LINE_STYLE: Record<DiffLine["kind"], React.CSSProperties> = {
  same: { color: "var(--text-secondary)" },
  add: { color: "var(--success, #3fb950)", background: "rgba(63,185,80,0.10)" },
  del: { color: "var(--danger, #f85149)", background: "rgba(248,81,73,0.10)" },
};
const PREFIX: Record<DiffLine["kind"], string> = { same: "  ", add: "+ ", del: "- " };

function DiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <pre className="mono" style={{ margin: "8px 0 0", padding: 10, fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", overflow: "auto" }}>
      {lines.map((l, i) => (
        <div key={i} style={LINE_STYLE[l.kind]}>
          {PREFIX[l.kind] + l.text}
        </div>
      ))}
    </pre>
  );
}

export function VersioningTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffOf, setDiffOf] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton height={160} />;
  if (isError) return <ErrorState body={t("versioning.loadError")} onRetry={() => refetch()} />;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{t("versioning.hint")}</p>
      {restore.isError && (
        <div role="alert" style={{ color: "var(--danger, #f85149)", fontSize: 13 }}>
          {restore.error instanceof ApiError ? restore.error.message : t("versioning.restoreFailed")}
        </div>
      )}
      {(data ?? []).map((v) => {
        const current = v.version === skill.version;
        return (
          <div key={v.version} style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="mono" style={{ fontWeight: 600 }}>{`v${v.version}`}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(v.created_at).toLocaleString()}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {current ? (
                  <Badge color="var(--accent)">{t("versioning.current")}</Badge>
                ) : (
                  <>
                    <Button size="sm" kind="secondary" icon="Code" onClick={() => setDiffOf(diffOf === v.version ? null : v.version)}>
                      {diffOf === v.version ? t("versioning.hideDiff") : t("versioning.diff")}
                    </Button>
                    <Button
                      size="sm"
                      kind="secondary"
                      icon="History"
                      loading={restore.isPending && restore.variables?.version === v.version}
                      onClick={() => restore.mutate({ id: skill.id, version: v.version })}
                    >
                      {t("versioning.restore")}
                    </Button>
                  </>
                )}
              </span>
            </div>
            {diffOf === v.version && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  {t("versioning.diffTitle", { version: v.version })}
                </div>
                <DiffView lines={lineDiff(v.body, skill.body)} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
