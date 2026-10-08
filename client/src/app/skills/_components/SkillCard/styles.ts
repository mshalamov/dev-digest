import type React from "react";

export const s = {
  card: (active: boolean, enabled: boolean): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: "var(--bg-surface)",
    cursor: "pointer",
    opacity: enabled ? 1 : 0.65,
  }),
  head: { display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  name: { flex: 1, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties,
  description: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } as React.CSSProperties,
  meta: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" } as React.CSSProperties,
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-muted)",
    display: "inline-flex",
    padding: 4,
  } as React.CSSProperties,
};
