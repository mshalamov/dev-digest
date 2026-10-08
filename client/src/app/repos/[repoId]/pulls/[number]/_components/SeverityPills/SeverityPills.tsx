/* SeverityPills — "N CRITICAL · N WARNING · N SUGGESTION" for one run, shown
   under the verdict and PR score. Only the levels present are shown. Each pill
   toggles the run card's severity filter. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITIES, type SeverityCounts } from "@/lib/severity";
import { s } from "./styles";

export function SeverityPills({
  counts,
  active = null,
  onToggle,
}: {
  counts: SeverityCounts;
  active?: Severity | null;
  onToggle?: (severity: Severity) => void;
}) {
  const t = useTranslations("prReview");
  const present = SEVERITIES.filter((sev) => counts[sev] > 0);
  if (present.length === 0) return null;
  return (
    <div role="group" aria-label={t("severity.pillsLabel")} style={s.row}>
      {present.map((sev, i) => {
        const I = Icon[SEV[sev].icon];
        const pressed = active === sev;
        return (
          <React.Fragment key={sev}>
            {i > 0 && (
              <span aria-hidden="true" style={s.sep}>
                ·
              </span>
            )}
            <button
              type="button"
              aria-pressed={pressed}
              onClick={() => onToggle?.(sev)}
              style={s.pill(sev, pressed, active != null && !pressed)}
            >
              <I size={12} />
              {t(`severity.pill.${sev}`, { count: counts[sev] })}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default SeverityPills;
