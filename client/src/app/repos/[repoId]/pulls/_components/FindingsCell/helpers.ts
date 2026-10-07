/** Pure helpers for the PR-list FINDINGS cell and its popover. */

/** Delay before closing, so the pointer can travel from the icons into the popover. */
export const CLOSE_DELAY_MS = 120;
export const POPOVER_WIDTH = 380;
export const POPOVER_MAX_HEIGHT = 360;
const GAP = 6;
const EDGE = 8;

/** `42` for a single line, `10-14` for a range. */
export function lineLabel(f: { start_line: number; end_line: number }): string {
  return f.end_line > f.start_line ? `${f.start_line}-${f.end_line}` : String(f.start_line);
}

/** Fixed-position coordinates: below the anchor when it fits (or when below is
 *  the roomier side), otherwise above; `maxHeight` shrinks to the free space so
 *  the title never leaves the screen. Clamped horizontally inside the viewport. */
export function popoverPosition(
  anchor: { top: number; bottom: number; left: number },
  viewport: { width: number; height: number },
): { left: number; top?: number; bottom?: number; maxHeight: number } {
  const left = Math.max(EDGE, Math.min(anchor.left, viewport.width - POPOVER_WIDTH - EDGE));
  const roomBelow = viewport.height - anchor.bottom - GAP - EDGE;
  const roomAbove = anchor.top - GAP - EDGE;
  return roomBelow >= POPOVER_MAX_HEIGHT || roomBelow >= roomAbove
    ? { left, top: anchor.bottom + GAP, maxHeight: Math.min(POPOVER_MAX_HEIGHT, roomBelow) }
    : { left, bottom: viewport.height - anchor.top + GAP, maxHeight: Math.min(POPOVER_MAX_HEIGHT, roomAbove) };
}
