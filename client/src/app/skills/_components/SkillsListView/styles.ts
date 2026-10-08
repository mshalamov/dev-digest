import type React from "react";

export const s = {
  page: { padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 } as React.CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 16 } as React.CSSProperties,
  titleBlock: { flex: 1 } as React.CSSProperties,
  title: { fontSize: 20, fontWeight: 700, margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" } as React.CSSProperties,
  search: { maxWidth: 360 } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
  } as React.CSSProperties,
  noMatch: { fontSize: 13, color: "var(--text-muted)" } as React.CSSProperties,
};
