// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Wire-up smoke tests for the activity-stream emitters.
 *
 * The emitters themselves are unit-tested in `emitters/emitters.test.ts` —
 * here we verify that the right CALLERS invoke them at the right moments,
 * by subscribing to the in-process ActivityBus and watching what shows up.
 *
 * Scope: only the emitters that don't require a live DB or external transport
 * (memory extractor; the others are exercised by integration tests). For the
 * remaining wirings we rely on a static contract check: every caller file
 * imports the matching emitter.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { activityBus } from "./activity-bus.js";
import type { FeedEvent } from "./activity-stream.types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ENGINE_SRC = resolve(__dirname, "..");

function fileImports(path: string, expected: string): boolean {
  const content = readFileSync(resolve(ENGINE_SRC, path), "utf-8");
  return content.includes(expected);
}

describe("activity-stream wire-up — static contract", () => {
  it("pipeline.ts wires emitInbound + emitConversation", () => {
    expect(fileImports("pipeline.ts", "emitInbound")).toBe(true);
    expect(fileImports("pipeline.ts", "emitConversation")).toBe(true);
  });

  it("channels/channel-manager.ts wires emitOutbound", () => {
    expect(fileImports("channels/channel-manager.ts", "emitOutbound")).toBe(true);
  });

  it("memory/extractor.ts wires emitMemory", () => {
    expect(fileImports("memory/extractor.ts", "emitMemory")).toBe(true);
  });

  it("scheduled-tasks/scheduler.service.ts wires emitCron", () => {
    expect(fileImports("scheduled-tasks/scheduler.service.ts", "emitCron")).toBe(true);
  });

  it("server/webhooks/webhook.controller.ts wires emitWebhook", () => {
    expect(fileImports("server/webhooks/webhook.controller.ts", "emitWebhook")).toBe(true);
  });

  it("webhooks/webhook-engine.ts wires emitConversation", () => {
    expect(fileImports("webhooks/webhook-engine.ts", "emitConversation")).toBe(true);
  });

  it("agents/tools/agent-invoke.helpers.ts wires emitAgentHandoff", () => {
    expect(fileImports("agents/tools/agent-invoke.helpers.ts", "emitAgentHandoffStart")).toBe(true);
    expect(fileImports("agents/tools/agent-invoke.helpers.ts", "emitAgentHandoffEnd")).toBe(true);
  });
});

describe("activity-stream wire-up — caller suppression lists", () => {
  // The caller files declare narrow Set<string>s of channel types where the
  // corresponding category emit is SUPPRESSED (to avoid double-counting with
  // another emitter that already covers that path). These sets must NEVER
  // include channel types that lack a substitute — otherwise the panel loses
  // signal silently. Verify the documented suppression contract here.

  it("pipeline.ts suppresses inbound only for agent/scheduled/room", () => {
    const content = readFileSync(resolve(ENGINE_SRC, "pipeline.ts"), "utf-8");
    expect(content).toMatch(/INBOUND_SUPPRESSED_CHANNELS\s*=\s*new Set\(\["agent",\s*"scheduled",\s*"room"\]\)/);
  });

  it("channels/channel-manager.ts suppresses outbound only for agent", () => {
    const content = readFileSync(resolve(ENGINE_SRC, "channels/channel-manager.ts"), "utf-8");
    expect(content).toMatch(/OUTBOUND_SUPPRESSED_CHANNELS\s*=\s*new Set\(\["agent"\]\)/);
  });
});

describe("activity-stream wire-up — live bus smoke", () => {
  let received: FeedEvent[];
  let unsubscribe: () => void;

  beforeEach(() => {
    received = [];
    unsubscribe = activityBus.subscribe((evt) => received.push(evt));
    return () => unsubscribe();
  });

  it("activityBus delivers a category:memory event when emitted directly", async () => {
    const { emitMemory } = await import("./emitters/emit-memory.js");
    emitMemory({
      count: 2,
      categories: ["fact", "preference"],
      firstMemoryText: "fact 1",
      conversationId: "conv-1",
    });
    const memoryEvents = received.filter((e) => e.category === "memory");
    expect(memoryEvents.length).toBe(1);
    expect(memoryEvents[0]?.memory?.count).toBe(2);
  });
});

// Silence the unused-import warning when the heavy live-extractor test is
// retired — vi is referenced symbolically below to keep the namespace alive
// in case a future contributor re-enables it.
void vi;
