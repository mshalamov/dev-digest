import type { CSSProperties } from "react";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

/** Co-located styles for SeverityPills. */
export const s = {
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  sep: { color: "var(--text-muted)", fontSize: 12 } satisfies CSSProperties,
  pill: (sev: Severity, pressed: boolean, dimmed: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: SEV[sev].c,
    background: SEV[sev].bg,
    border: `1px solid ${pressed ? SEV[sev].c : "transparent"}`,
    opacity: dimmed ? 0.5 : 1,
    cursor: "pointer",
  }),
} as const;
