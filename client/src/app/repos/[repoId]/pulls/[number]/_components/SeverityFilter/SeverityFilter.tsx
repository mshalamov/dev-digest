/* SeverityFilter — the Critical / Warning / Suggestion buttons above a run's
   finding cards. All three are always shown; clicking the active one clears. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITIES } from "@/lib/severity";
import { s } from "./styles";

export function SeverityFilter({
  active,
  onToggle,
}: {
  active: Severity | null;
  onToggle: (severity: Severity) => void;
}) {
  const t = useTranslations("prReview");
  return (
    <div role="group" aria-label={t("severity.filterLabel")} style={s.group}>
      {SEVERITIES.map((sev) => {
        const I = Icon[SEV[sev].icon];
        const pressed = active === sev;
        return (
          <button key={sev} type="button" aria-pressed={pressed} onClick={() => onToggle(sev)} style={s.btn(sev, pressed)}>
            <I size={12} />
            {t(`severity.filter.${sev}`)}
          </button>
        );
      })}
    </div>
  );
}

export default SeverityFilter;
