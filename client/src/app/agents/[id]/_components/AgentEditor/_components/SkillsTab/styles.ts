import type React from "react";

export const s = {
  wrap: { padding: "20px 28px", maxWidth: 1080 } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12 } as React.CSSProperties,
  title: { fontSize: 18, fontWeight: 700, margin: 0 } as React.CSSProperties,
  filter: { marginLeft: "auto", width: 300 } as React.CSSProperties,
  hint: { fontSize: 13, color: "var(--text-secondary)", margin: "12px 0" } as React.CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 8 } as React.CSSProperties,
  row: (linked: boolean, dragging: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: linked ? "var(--bg-elevated)" : "var(--bg-surface)",
    opacity: dragging ? 0.5 : 1,
    cursor: linked ? "grab" : "default",
  }),
  handle: (linked: boolean): React.CSSProperties => ({
    width: 14,
    display: "inline-flex",
    color: linked ? "var(--text-muted)" : "transparent",
  }),
  name: { flex: 1, fontSize: 14 } as React.CSSProperties,
  error: { marginTop: 12, fontSize: 13, color: "var(--danger, #f85149)" } as React.CSSProperties,
};
