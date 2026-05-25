// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import { processContent, processThinkContent, type StreamCallbacks } from "./stream-parser";

function makeCallbacks() {
  return {
    onDelta: vi.fn(),
    onToolCallStart: vi.fn(),
    onToolCallEnd: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  } satisfies StreamCallbacks;
}

describe("processContent", () => {
  it("passes regular content to onDelta when not inside think block", () => {
    const cb = makeCallbacks();
    const setThink = vi.fn();

    processContent("Hello world", false, cb, setThink);

    expect(cb.onDelta).toHaveBeenCalledWith("Hello world");
    expect(setThink).not.toHaveBeenCalled();
  });

  it("enters think mode on <think> tag", () => {
    const cb = makeCallbacks();
    const setThink = vi.fn();

    processContent("<think>", false, cb, setThink);

    expect(setThink).toHaveBeenCalledWith(true);
    expect(cb.onDelta).not.toHaveBeenCalled();
  });

  it("processes content after <think> tag as think content", () => {
    const cb = makeCallbacks();
    const setThink = vi.fn();

    processContent("<think>\n⏳ web_search...", false, cb, setThink);

    expect(setThink).toHaveBeenCalledWith(true);
    expect(cb.onToolCallStart).toHaveBeenCalledWith("web_search");
    expect(cb.onDelta).not.toHaveBeenCalled();
  });

  it("exits think mode on </think> tag", () => {
    const cb = makeCallbacks();
    const setThink = vi.fn();

    processContent("</think>", true, cb, setThink);

    expect(setThink).toHaveBeenCalledWith(false);
    expect(cb.onDelta).not.toHaveBeenCalled();
  });

  it("passes content after </think> as regular delta", () => {
    const cb = makeCallbacks();
    const setThink = vi.fn();

    processContent("</think>Here is the result", true, cb, setThink);

    expect(setThink).toHaveBeenCalledWith(false);
    expect(cb.onDelta).toHaveBeenCalledWith("Here is the result");
  });

  it("routes content inside think block to processThinkContent", () => {
    const cb = makeCallbacks();
    const setThink = vi.fn();

    processContent("⏳ read_file...", true, cb, setThink);

    expect(cb.onToolCallStart).toHaveBeenCalledWith("read_file");
    expect(cb.onDelta).not.toHaveBeenCalled();
  });
});

describe("processThinkContent", () => {
  it("detects tool call start pattern", () => {
    const cb = makeCallbacks();
    processThinkContent("⏳ web_search...", cb);
    expect(cb.onToolCallStart).toHaveBeenCalledWith("web_search");
  });

  it("detects tool call end pattern", () => {
    const cb = makeCallbacks();
    processThinkContent("✓ web_search", cb);
    expect(cb.onToolCallEnd).toHaveBeenCalledWith("web_search");
  });

  it("handles multiple lines", () => {
    const cb = makeCallbacks();
    processThinkContent("⏳ tool_a...\n✓ tool_b", cb);

    expect(cb.onToolCallStart).toHaveBeenCalledWith("tool_a");
    expect(cb.onToolCallEnd).toHaveBeenCalledWith("tool_b");
  });

  it("ignores empty lines", () => {
    const cb = makeCallbacks();
    processThinkContent("\n\n\n", cb);

    expect(cb.onToolCallStart).not.toHaveBeenCalled();
    expect(cb.onToolCallEnd).not.toHaveBeenCalled();
  });

  it("ignores unrecognized think content", () => {
    const cb = makeCallbacks();
    processThinkContent("some random thinking text", cb);

    expect(cb.onToolCallStart).not.toHaveBeenCalled();
    expect(cb.onToolCallEnd).not.toHaveBeenCalled();
  });

  it("handles tool names with special characters", () => {
    const cb = makeCallbacks();
    processThinkContent("⏳ my-tool_v2...", cb);
    expect(cb.onToolCallStart).toHaveBeenCalledWith("my-tool_v2");
  });
});
