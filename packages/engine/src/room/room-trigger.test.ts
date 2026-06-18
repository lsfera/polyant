// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted mocks ─────────────────────────────────────────────── */

const { mockBoss, mockRoomLog } = vi.hoisted(() => ({
  mockBoss: { send: vi.fn() },
  mockRoomLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock the shared pg-boss client — the trigger enqueue path must never touch
// the network in a unit test.
vi.mock("../scheduler/pg-boss-client.js", () => ({
  boss: mockBoss,
  startBoss: vi.fn(),
  stopBoss: vi.fn(),
  isBossStarted: vi.fn(() => true),
}));
vi.mock("./room-logger.js", () => ({ roomLog: mockRoomLog }));

/* ── import under test ─────────────────────────────────────────── */

import { enqueueRoomTrigger } from "./room-trigger.js";

/* ── setup ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockBoss.send.mockResolvedValue("job-id");
});

/* ── tests (Seam 3) ─────────────────────────────────────────────── */

describe("enqueueRoomTrigger", () => {
  it("sends a room-cycle job with priority 10 and a trigger singletonKey", async () => {
    await enqueueRoomTrigger("inst-a", "Help me please");

    expect(mockBoss.send).toHaveBeenCalledTimes(1);
    expect(mockBoss.send).toHaveBeenCalledWith(
      "room-cycle",
      { instanceId: "inst-a", humanMessage: "Help me please" },
      { singletonKey: "trigger:inst-a", priority: 10, expireInSeconds: 300 },
    );
  });

  it("namespaces the singletonKey per instance so tick + trigger coexist", async () => {
    await enqueueRoomTrigger("inst-b", "hi");

    expect(mockBoss.send).toHaveBeenCalledWith(
      "room-cycle",
      expect.objectContaining({ instanceId: "inst-b" }),
      expect.objectContaining({ singletonKey: "trigger:inst-b", priority: 10 }),
    );
  });
});
