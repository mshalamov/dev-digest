import type { CSSProperties } from "react";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

/** Co-located styles for SeverityFilter. */
export const s = {
  group: { display: "flex", alignItems: "center", gap: 6 } satisfies CSSProperties,
  btn: (sev: Severity, pressed: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
    color: pressed ? SEV[sev].c : "var(--text-secondary)",
    background: pressed ? SEV[sev].bg : "transparent",
    border: `1px solid ${pressed ? SEV[sev].c : "var(--border)"}`,
  }),
} as const;
