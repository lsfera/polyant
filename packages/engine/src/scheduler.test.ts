// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted mocks ─────────────────────────────────────────────── */

const {
  mockListEnabledRooms,
  mockCountPendingByInstance,
  mockResolveInstanceSlug,
  mockSchedulerLog,
} = vi.hoisted(() => ({
  mockListEnabledRooms: vi.fn(),
  mockCountPendingByInstance: vi.fn(),
  mockResolveInstanceSlug: vi.fn(),
  mockSchedulerLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./room/room.store.js", () => ({ listEnabledRooms: mockListEnabledRooms }));
vi.mock("./webhooks/webhook-backlog.store.js", () => ({
  countPendingByInstance: mockCountPendingByInstance,
}));
vi.mock("./instances/resolve-instance-id.js", () => ({
  resolveInstanceSlug: mockResolveInstanceSlug,
}));
vi.mock("./room/room-logger.js", () => ({ roomLog: mockSchedulerLog }));

// Mock the shared pg-boss client so the unit test never constructs a real
// PgBoss instance or touches the network — Seam 1 injects a fake boss into
// schedulerTick() directly.
vi.mock("./scheduler/pg-boss-client.js", () => ({
  boss: { send: vi.fn(), createQueue: vi.fn(), start: vi.fn(), stop: vi.fn() },
  startBoss: vi.fn(),
  stopBoss: vi.fn(),
  isBossStarted: vi.fn(() => false),
}));

/* ── import under test ─────────────────────────────────────────── */

import { schedulerTick } from "./scheduler.js";

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

const ROOM_B = {
  ...ROOM_A,
  id: "room-b",
  instanceId: "inst-b",
  conversationId: "room:inst-b",
};

function makeBoss() {
  return { send: vi.fn().mockResolvedValue("job-id") };
}

/* ── setup ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockListEnabledRooms.mockResolvedValue([]);
  mockCountPendingByInstance.mockResolvedValue(new Map());
  mockResolveInstanceSlug.mockResolvedValue("inst-a-slug");
});

/* ── tests ──────────────────────────────────────────────────────── */

describe("schedulerTick", () => {
  it("enqueues a room-cycle job for a room with pending events", async () => {
    mockListEnabledRooms.mockResolvedValue([ROOM_A]);
    mockCountPendingByInstance.mockResolvedValue(new Map([["inst-a", 3]]));
    mockResolveInstanceSlug.mockResolvedValue("inst-a-slug");
    const boss = makeBoss();

    await schedulerTick(boss as never);

    expect(boss.send).toHaveBeenCalledTimes(1);
    expect(boss.send).toHaveBeenCalledWith(
      "room-cycle",
      { instanceId: "inst-a", instanceSlug: "inst-a-slug" },
      { singletonKey: "inst-a", priority: 0, expireInSeconds: 300 },
    );
  });

  it("does not enqueue for rooms with zero pending events", async () => {
    mockListEnabledRooms.mockResolvedValue([ROOM_A]);
    mockCountPendingByInstance.mockResolvedValue(new Map());
    const boss = makeBoss();

    await schedulerTick(boss as never);

    expect(boss.send).not.toHaveBeenCalled();
  });

  it("does not enqueue for rooms whose pending count is explicitly zero", async () => {
    mockListEnabledRooms.mockResolvedValue([ROOM_A]);
    mockCountPendingByInstance.mockResolvedValue(new Map([["inst-a", 0]]));
    const boss = makeBoss();

    await schedulerTick(boss as never);

    expect(boss.send).not.toHaveBeenCalled();
  });

  it("enqueues a job per room with pending events, using each room's singletonKey and slug", async () => {
    mockListEnabledRooms.mockResolvedValue([ROOM_A, ROOM_B]);
    mockCountPendingByInstance.mockResolvedValue(
      new Map([
        ["inst-a", 2],
        ["inst-b", 1],
      ]),
    );
    mockResolveInstanceSlug
      .mockResolvedValueOnce("inst-a-slug")
      .mockResolvedValueOnce("inst-b-slug");
    const boss = makeBoss();

    await schedulerTick(boss as never);

    expect(boss.send).toHaveBeenCalledTimes(2);
    expect(boss.send).toHaveBeenCalledWith(
      "room-cycle",
      { instanceId: "inst-a", instanceSlug: "inst-a-slug" },
      { singletonKey: "inst-a", priority: 0, expireInSeconds: 300 },
    );
    expect(boss.send).toHaveBeenCalledWith(
      "room-cycle",
      { instanceId: "inst-b", instanceSlug: "inst-b-slug" },
      { singletonKey: "inst-b", priority: 0, expireInSeconds: 300 },
    );
  });

  it("enqueues only the room with pending events when others are idle", async () => {
    mockListEnabledRooms.mockResolvedValue([ROOM_A, ROOM_B]);
    mockCountPendingByInstance.mockResolvedValue(new Map([["inst-b", 5]]));
    mockResolveInstanceSlug.mockResolvedValue("inst-b-slug");
    const boss = makeBoss();

    await schedulerTick(boss as never);

    expect(boss.send).toHaveBeenCalledTimes(1);
    expect(boss.send).toHaveBeenCalledWith(
      "room-cycle",
      { instanceId: "inst-b", instanceSlug: "inst-b-slug" },
      { singletonKey: "inst-b", priority: 0, expireInSeconds: 300 },
    );
  });

  it("skips a room when its instance slug cannot be resolved", async () => {
    mockListEnabledRooms.mockResolvedValue([ROOM_A]);
    mockCountPendingByInstance.mockResolvedValue(new Map([["inst-a", 4]]));
    mockResolveInstanceSlug.mockResolvedValue(undefined);
    const boss = makeBoss();

    await schedulerTick(boss as never);

    expect(boss.send).not.toHaveBeenCalled();
  });
});
