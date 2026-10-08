import type { CSSProperties } from "react";
import { POPOVER_MAX_HEIGHT, POPOVER_WIDTH } from "./helpers";

/** Co-located styles for FindingsCell + FindingsPopover. */
export const s = {
  muted: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "2px 4px",
    borderRadius: 5,
    cursor: "default",
  } satisfies CSSProperties,
  sevCount: (color: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    color,
  }),
  popover: (pos: CSSProperties): CSSProperties => ({
    position: "fixed",
    zIndex: 1000,
    width: POPOVER_WIDTH,
    maxHeight: POPOVER_MAX_HEIGHT,
    overflowY: "auto",
    padding: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    cursor: "default",
    ...pos,
  }),
  popoverTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    marginBottom: 8,
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  item: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  itemHead: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 } satisfies CSSProperties,
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  itemMeta: { display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,
  more: { marginTop: 10, fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,
  itemSummary: { margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--text-secondary)" } satisfies CSSProperties,
} as const;
