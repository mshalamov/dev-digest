/* FindingsPanel — severity filter + hide-low-confidence + j/k navigation + FindingCard list,
   wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { toggleSeverity } from "@/lib/severity";
import { FindingCard } from "../FindingCard";
import { SeverityFilter } from "../SeverityFilter";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION } from "./constants";
import { visibleFindings } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
  severity,
  onSeverityChange,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
  severity?: Severity | null;
  onSeverityChange?: (severity: Severity | null) => void;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState(0);
  // Controlled by the run card (shared with the verdict pills) when it passes
  // `onSeverityChange`; otherwise the panel keeps its own filter.
  const [ownSeverity, setOwnSeverity] = React.useState<Severity | null>(null);
  const activeSeverity = onSeverityChange ? (severity ?? null) : ownSeverity;
  const setSeverity = onSeverityChange ?? setOwnSeverity;

  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, activeSeverity),
    [findings, hideLow, activeSeverity],
  );
  // A filter change reshapes the list: reset keyboard focus during render (not
  // in an effect, which would leave the old index live for one commit) so a/d
  // never act on a card that is no longer visible.
  const filterKey = `${activeSeverity ?? "all"}|${hideLow}`;
  const [focusFilterKey, setFocusFilterKey] = React.useState(filterKey);
  if (focusFilterKey !== filterKey) {
    setFocusFilterKey(filterKey);
    setFocusIdx(0);
  }
  // A refetch can shrink the list under the cursor: clamp to the last card.
  const focused = Math.min(focusIdx, Math.max(shown.length - 1, 0));

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx(Math.min(focused + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx(Math.max(focused - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focused]) {
        action.mutate({ findingId: shown[focused]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focused, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        <SeverityFilter
          active={activeSeverity}
          onToggle={(sev) => setSeverity(toggleSeverity(activeSeverity, sev))}
        />
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focused}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
