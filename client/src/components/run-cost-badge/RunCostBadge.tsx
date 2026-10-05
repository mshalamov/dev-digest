/* RunCostBadge — a run's cost (and, on the timeline, input tokens). Ported from
   the design's CostBadge.
   compact  → "$0.012" (review-card header)
   total    → "$0.012" (PR list COST column; tooltip says it totals all runs)
   timeline → "9,119 tok · $0.0013" (PR timeline run row, under the time; input tokens)
   No cost data renders "--" (never $0.00); tokens are only shown next to a real cost. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { NO_DATA, formatCostUsd } from "./format";

export type RunCostBadgeVariant = "compact" | "timeline" | "total";

const s = {
  cost: (variant: RunCostBadgeVariant): CSSProperties => ({
    fontSize: variant === "timeline" ? 11 : 11.5,
    fontWeight: variant === "timeline" ? 400 : 500,
    color: "var(--text-secondary)",
  }),
  none: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
};

export function RunCostBadge({
  variant,
  costUsd,
  tokensIn,
}: {
  variant: RunCostBadgeVariant;
  costUsd: number | null | undefined;
  tokensIn?: number | null;
}) {
  const t = useTranslations("prReview");
  const cost = formatCostUsd(costUsd);
  if (cost === NO_DATA) {
    return (
      <span className="mono" style={s.none} title={t("cost.noneTitle")}>
        {t("cost.none")}
      </span>
    );
  }
  if (variant === "timeline") {
    return (
      <span className="mono tnum" style={s.cost(variant)} title={t("cost.title")}>
        {tokensIn != null
          ? t("cost.timeline", { tokens: tokensIn.toLocaleString("en-US"), cost })
          : cost}
      </span>
    );
  }
  return (
    <span
      className="mono tnum"
      style={s.cost(variant)}
      title={variant === "total" ? t("cost.totalTitle") : t("cost.title")}
    >
      {cost}
    </span>
  );
}

export default RunCostBadge;
