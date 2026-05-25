// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import {
  toolNameForTarget,
  buildAgentInvokeTool,
} from "./agent-invoke.helpers.js";

describe("toolNameForTarget", () => {
  it("converts kebab-case slug to snake_case tool name with ask_ prefix", () => {
    expect(toolNameForTarget("data-scout")).toBe("ask_data_scout");
    expect(toolNameForTarget("acme")).toBe("ask_acme");
    expect(toolNameForTarget("ab-c-d")).toBe("ask_ab_c_d");
  });
});

describe("buildAgentInvokeTool", () => {
  const baseTarget = {
    id: "tgt-uuid",
    slug: "data-scout",
    name: "Data Scout",
    description: "Expert at enriching contacts via web search.",
  };

  it("returns a tool with name, description, and inputSchema derived from target", () => {
    const dispatch = vi.fn(async () => "result-text");
    const tool = buildAgentInvokeTool({
      target: baseTarget,
      callerSlug: "acme",
      callerConversationId: "conv-1",
      currentDepth: 0,
      timeoutMs: 60000,
      dispatch,
    });

    expect(tool.name).toBe("ask_data_scout");
    expect(tool.description).toContain("Data Scout");
    expect(tool.description).toContain("Expert");
  });

  it("returns the dispatched text on success and forwards depth+1", async () => {
    const dispatch = vi.fn(async () => "ok");
    const tool = buildAgentInvokeTool({
      target: baseTarget,
      callerSlug: "acme",
      callerConversationId: "conv-1",
      currentDepth: 0,
      timeoutMs: 60000,
      dispatch,
    });
    const result = await tool.execute({ prompt: "hello" });
    expect(result).toBe("ok");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "hello",
        depth: 1,
        targetInstanceId: "data-scout",
        callerSlug: "acme",
        callerConversationId: "conv-1",
      })
    );
  });

  it("returns the depth-guard error when currentDepth >= 1, without dispatching", async () => {
    const dispatch = vi.fn();
    const tool = buildAgentInvokeTool({
      target: baseTarget,
      callerSlug: "x",
      callerConversationId: "x",
      currentDepth: 1,
      timeoutMs: 60000,
      dispatch,
    });
    const result = await tool.execute({ prompt: "x" });
    expect(result).toMatch(/nested agent invocation not allowed/i);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns an error string prefixed by 'Error:' when dispatch throws", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("boom");
    });
    const tool = buildAgentInvokeTool({
      target: baseTarget,
      callerSlug: "x",
      callerConversationId: "x",
      currentDepth: 0,
      timeoutMs: 60000,
      dispatch,
    });
    const result = await tool.execute({ prompt: "x" });
    expect(result).toMatch(/^Error: /);
    expect(result).toContain("boom");
  });

  it("returns timeout error when dispatch exceeds timeoutMs", async () => {
    const dispatch = vi.fn(
      (input: { signal?: AbortSignal }) =>
        new Promise<string>((_resolve, reject) => {
          input.signal?.addEventListener("abort", () =>
            reject(new Error("aborted"))
          );
        })
    );
    const tool = buildAgentInvokeTool({
      target: baseTarget,
      callerSlug: "x",
      callerConversationId: "x",
      currentDepth: 0,
      timeoutMs: 50,
      dispatch,
    });
    const result = await tool.execute({ prompt: "x" });
    expect(result).toMatch(/timed out/i);
  });
});
