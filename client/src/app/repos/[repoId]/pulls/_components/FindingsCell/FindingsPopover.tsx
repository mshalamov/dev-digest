/* FindingsPopover — read-only preview of a PR's latest-run findings, opened by
   hovering the FINDINGS cell in the PR list. Text only: no Accept/Reject (those
   live on the PR page's run card) and no links. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SeverityBadge, CategoryTag } from "@devdigest/ui";
import type { PrFindingPreview } from "@devdigest/shared";
import { lineLabel, popoverPosition } from "./helpers";
import { s } from "./styles";

export function FindingsPopover({
  id,
  findings,
  total,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: {
  id: string;
  findings: PrFindingPreview[];
  /** Findings in the run; `findings` may be a capped preview of them. */
  total: number;
  anchor: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const t = useTranslations("prReview");
  const title = t("list.findings.popoverTitle", { count: total });
  const pos = popoverPosition(anchor, { width: window.innerWidth, height: window.innerHeight });
  return (
    <div
      id={id}
      role="dialog"
      aria-label={title}
      style={s.popover(pos)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // Portalled, but React events still bubble to PRRow's onClick (navigation).
      onClick={(e) => e.stopPropagation()}
    >
      <div style={s.popoverTitle}>{title}</div>
      <ul style={s.list}>
        {findings.map((f) => (
          <li key={f.id} style={s.item}>
            <div style={s.itemHead}>
              <SeverityBadge severity={f.severity} compact />
              <span style={s.itemTitle}>{f.title}</span>
            </div>
            <div style={s.itemMeta}>
              <CategoryTag category={f.category} />
              <span className="mono">
                {f.file}:{lineLabel(f)}
              </span>
              <span className="mono tnum">
                {t("list.findings.confidence", { pct: Math.round(f.confidence * 100) })}
              </span>
            </div>
            {f.summary && <p style={s.itemSummary}>{f.summary}</p>}
          </li>
        ))}
      </ul>
      {total > findings.length && (
        <div style={s.more}>{t("list.findings.more", { count: total - findings.length })}</div>
      )}
    </div>
  );
}

export default FindingsPopover;
