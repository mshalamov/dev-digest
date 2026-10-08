/* FindingsCell — PR-list FINDINGS column: one icon + count per severity present
   in the PR's latest run. Hover, focus or tap opens FindingsPopover ("N FINDINGS
   IN THIS RUN"). Counts come from the list payload (`findings_counts`, else the
   preview itself): no fetch. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { PrFindingCounts, PrFindingPreview } from "@devdigest/shared";
import { SEVERITIES, countBySeverity, isSeverity } from "@/lib/severity";
import { FindingsPopover } from "./FindingsPopover";
import { CLOSE_DELAY_MS } from "./helpers";
import { s } from "./styles";

export function FindingsCell({
  findings,
  counts: totals,
}: {
  findings: PrFindingPreview[] | null | undefined;
  /** Full per-severity totals; the preview in `findings` may be capped. */
  counts?: PrFindingCounts | null;
}) {
  const t = useTranslations("prReview");
  const popoverId = React.useId();
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const isOpen = anchor != null;

  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // While open: Escape closes it from anywhere (hover content must be
  // dismissible without moving the pointer), and scroll/resize close it rather
  // than leave a fixed-position popover floating away from its row.
  React.useEffect(() => {
    if (!isOpen) return;
    const close = () => setAnchor(null);
    // Capture sees every scroll, including the popover's own list: ignore those.
    const onScroll = (e: Event) => {
      const pop = document.getElementById(popoverId);
      if (pop && e.target instanceof Node && pop.contains(e.target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, popoverId]);

  if (findings == null) {
    return (
      <span style={s.muted} title={t("list.findings.notReviewed")}>
        —
      </span>
    );
  }
  // Bad data (an unknown severity) is skipped, never rendered: the badge throws on it.
  const known = findings.filter((f) => isSeverity(f.severity));
  const counts = totals ?? countBySeverity(known);
  const total = SEVERITIES.reduce((n, sev) => n + counts[sev], 0);
  if (total === 0) {
    return (
      <span className="mono" style={s.muted} title={t("list.findings.noneTitle")}>
        0
      </span>
    );
  }

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const open = () => {
    cancelClose();
    if (triggerRef.current) setAnchor(triggerRef.current.getBoundingClientRect());
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setAnchor(null), CLOSE_DELAY_MS);
  };

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={t("list.findings.trigger", { count: total })}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? popoverId : undefined}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
        // A tap/click previews the findings; it must not bubble to PRRow (navigation).
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        style={s.trigger}
      >
        {SEVERITIES.filter((sev) => counts[sev] > 0).map((sev) => {
          const I = Icon[SEV[sev].icon];
          return (
            <span key={sev} style={s.sevCount(SEV[sev].c)}>
              <I size={13} />
              <span className="mono tnum">{counts[sev]}</span>
            </span>
          );
        })}
      </span>
      {anchor &&
        createPortal(
          <FindingsPopover
            id={popoverId}
            findings={known}
            total={total}
            anchor={anchor}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          />,
          document.body,
        )}
    </>
  );
}

export default FindingsCell;
