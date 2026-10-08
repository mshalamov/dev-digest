/* PreviewTab — the skill body rendered as markdown (what the agent will read). */
"use client";

import React from "react";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";

export function PreviewTab({ skill }: { skill: Skill }) {
  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 12 }}>
      <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: "3px solid var(--border)", color: "var(--text-secondary)" }}>
        {skill.description}
      </blockquote>
      <Markdown>{skill.body}</Markdown>
    </div>
  );
}
