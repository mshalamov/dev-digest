import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../api", () => ({ api: { post, get } }));

import { useSetAgentSkills } from "./agents";

const link = (skill_id: string, order: number) => ({ agent_id: "a1", skill_id, order });

describe("useSetAgentSkills", () => {
  it("updates links optimistically and saves quick clicks one at a time, in order", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["agent-skills", "a1"], []);
    let releaseFirst!: (value: unknown) => void;
    post.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)));
    post.mockImplementationOnce(async () => [link("s1", 0), link("s2", 1)]);
    get.mockResolvedValue([link("s1", 0), link("s2", 1)]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetAgentSkills(), { wrapper });

    act(() => result.current.mutate({ agentId: "a1", skillIds: ["s1"] }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(qc.getQueryData(["agent-skills", "a1"])).toEqual([link("s1", 0)]);

    // Second click while the first save is in flight: cache shows both at once…
    act(() => result.current.mutate({ agentId: "a1", skillIds: ["s1", "s2"] }));
    await waitFor(() => expect(qc.getQueryData(["agent-skills", "a1"])).toEqual([link("s1", 0), link("s2", 1)]));
    // …but the request waits for the first one.
    await new Promise((r) => setTimeout(r, 20));
    expect(post).toHaveBeenCalledTimes(1);

    releaseFirst([link("s1", 0)]);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenLastCalledWith("/agents/a1/skills", { skill_ids: ["s1", "s2"] });
    // The first save's response never rolls the list back to [s1].
    expect(qc.getQueryData(["agent-skills", "a1"])).toEqual([link("s1", 0), link("s2", 1)]);
  });
});
