/* /skills/:id — one skill. Tab state lives in ?tab=. */
"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../components/app-shell";
import { SkillTypeBadge } from "../../../components/skill-type-badge";
import { useSkill } from "../../../lib/hooks/skills";
import { ApiError } from "../../../lib/api";
import { SkillDetail, VALID_TABS } from "./_components/SkillDetail";

export default function SkillPage() {
  const t = useTranslations("skills");
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);

  const requested = search.get("tab") ?? "";
  const tab = VALID_TABS.includes(requested) ? requested : "config";
  const setTab = (next: string) => router.replace(`/skills/${id}?tab=${next}`);
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.heading"), href: "/skills" },
    { label: skill?.name ?? t("detail.crumbSkill") },
  ];

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={notFound ? t("detail.notFoundTitle") : t("detail.loadError")}
          body={notFound ? t("detail.notFoundBody") : error instanceof ApiError ? error.message : undefined}
          onRetry={notFound ? undefined : () => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      {isLoading || !skill ? (
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={24} width={240} />
          <Skeleton height={200} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 24px 12px", display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/skills" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {t("detail.back")}
            </Link>
            <h1 className="mono" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {skill.name}
            </h1>
            <SkillTypeBadge type={skill.type} />
            <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("card.version", { version: skill.version })}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("card.agentCount", { count: skill.agent_count ?? 0 })}
            </span>
          </div>
          <SkillDetail skill={skill} tab={tab} onTab={setTab} />
        </div>
      )}
    </AppShell>
  );
}
