// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted mocks ─────────────────────────────────────────────── */

const {
  mockExecuteRoomCycle,
  mockGetRoomByInstanceId,
  mockResolveInstanceSlug,
  mockCompactActivityLog,
  mockRunAnalyticsCleanup,
  mockListEnabledRooms,
  mockRoomLog,
} = vi.hoisted(() => ({
  mockExecuteRoomCycle: vi.fn(),
  mockGetRoomByInstanceId: vi.fn(),
  mockResolveInstanceSlug: vi.fn(),
  mockCompactActivityLog: vi.fn(),
  mockRunAnalyticsCleanup: vi.fn(),
  mockListEnabledRooms: vi.fn(),
  mockRoomLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./room-engine.js", () => ({ executeRoomCycle: mockExecuteRoomCycle }));
vi.mock("./room.store.js", () => ({
  getRoomByInstanceId: mockGetRoomByInstanceId,
  listEnabledRooms: mockListEnabledRooms,
}));
vi.mock("../instances/resolve-instance-id.js", () => ({
  resolveInstanceSlug: mockResolveInstanceSlug,
}));
vi.mock("./activity-log.store.js", () => ({ compactActivityLog: mockCompactActivityLog }));
vi.mock("../analytics/cleanup.js", () => ({ runAnalyticsCleanup: mockRunAnalyticsCleanup }));
vi.mock("./room-logger.js", () => ({ roomLog: mockRoomLog }));

// Mock the shared pg-boss client so the unit test never constructs a real
// PgBoss instance or touches the network.
vi.mock("../scheduler/pg-boss-client.js", () => ({
  boss: { send: vi.fn(), createQueue: vi.fn(), work: vi.fn(), offWork: vi.fn() },
  startBoss: vi.fn(),
  stopBoss: vi.fn(),
  isBossStarted: vi.fn(() => false),
}));

/* ── import under test ─────────────────────────────────────────── */

import { dispatchRoomCycleJob } from "./room-worker.js";

/* ── helpers ────────────────────────────────────────────────────── */

const ROOM_A = {
  id: "room-a",
  instanceId: "inst-a",
  enabled: true,
  prompt: "Agent A",
  outboundChannel: "slack" as const,
  outboundTarget: "#a",
  evalIntervalMinutes: 5,
  conversationId: "room:inst-a",
};

function makeJob(data: Record<string, unknown>) {
  return { id: "job-1", name: "room-cycle", data } as never;
}

/* ── setup ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRoomByInstanceId.mockResolvedValue(ROOM_A);
  mockResolveInstanceSlug.mockResolvedValue("inst-a-slug");
  mockExecuteRoomCycle.mockResolvedValue(undefined);
});

/* ── tests (Seam 2) ─────────────────────────────────────────────── */

describe("dispatchRoomCycleJob", () => {
  it("dispatches a tick job: resolves room + slug, no human message", async () => {
    await dispatchRoomCycleJob(makeJob({ instanceId: "inst-a", instanceSlug: "inst-a-slug" }));

    expect(mockGetRoomByInstanceId).toHaveBeenCalledWith("inst-a");
    expect(mockResolveInstanceSlug).toHaveBeenCalledWith("inst-a");
    expect(mockExecuteRoomCycle).toHaveBeenCalledTimes(1);
    expect(mockExecuteRoomCycle).toHaveBeenCalledWith(ROOM_A, "inst-a-slug", undefined);
  });

  it("dispatches a trigger job: forwards the human message", async () => {
    await dispatchRoomCycleJob(
      makeJob({ instanceId: "inst-a", humanMessage: "Help me please" }),
    );

    expect(mockExecuteRoomCycle).toHaveBeenCalledTimes(1);
    expect(mockExecuteRoomCycle).toHaveBeenCalledWith(ROOM_A, "inst-a-slug", "Help me please");
  });

  it("skips when the room cannot be resolved", async () => {
    mockGetRoomByInstanceId.mockResolvedValue(null);

    await dispatchRoomCycleJob(makeJob({ instanceId: "inst-a" }));

    expect(mockExecuteRoomCycle).not.toHaveBeenCalled();
  });

  it("skips when the slug cannot be resolved", async () => {
    mockResolveInstanceSlug.mockResolvedValue(undefined);

    await dispatchRoomCycleJob(makeJob({ instanceId: "inst-a" }));

    expect(mockExecuteRoomCycle).not.toHaveBeenCalled();
  });

  it("swallows executeRoomCycle errors and logs them (no retry storm)", async () => {
    const failure = new Error("LLM timeout");
    mockExecuteRoomCycle.mockRejectedValueOnce(failure);

    await expect(
      dispatchRoomCycleJob(makeJob({ instanceId: "inst-a", humanMessage: "Will fail" })),
    ).resolves.toBeUndefined();

    expect(mockRoomLog.error).toHaveBeenCalled();
  });
});
