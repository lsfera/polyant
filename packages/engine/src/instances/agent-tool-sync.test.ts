// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";

const upserts: any[] = [];
const deletes: any[] = [];

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../database/client.js", () => ({ db: mockDb }));

vi.mock("../agents/tools/tools.schema.js", () => ({
  tools: { name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
}));

import { syncAgentTool } from "./agent-tool-sync.js";

beforeEach(() => {
  upserts.length = 0;
  deletes.length = 0;
  vi.clearAllMocks();

  mockDb.insert.mockImplementation(() => ({
    values: (v: unknown) => ({
      onConflictDoUpdate: (cfg: unknown) => {
        upserts.push({ values: v, conflict: cfg });
        return Promise.resolve();
      },
    }),
  }));
  mockDb.delete.mockImplementation(() => ({
    where: (w: unknown) => {
      deletes.push(w);
      return Promise.resolve();
    },
  }));
});

describe("syncAgentTool", () => {
  it("upserts a tools row when enable=true with description from target", async () => {
    await syncAgentTool({
      slug: "data-scout",
      description: "Expert at enrichment",
      enable: true,
    });
    expect(upserts.length).toBe(1);
    expect(upserts[0].values.name).toBe("agent:data-scout");
    expect(upserts[0].values.category).toBe("agent");
    expect(upserts[0].values.description).toBe("Expert at enrichment");
  });

  it("falls back to a generic description when target description is empty", async () => {
    await syncAgentTool({
      slug: "data-scout",
      description: null,
      enable: true,
    });
    expect(upserts.length).toBe(1);
    expect(upserts[0].values.description).toMatch(/agent/i);
  });

  it("deletes the tools row when enable=false", async () => {
    await syncAgentTool({
      slug: "data-scout",
      description: null,
      enable: false,
    });
    expect(deletes.length).toBe(1);
    expect(upserts.length).toBe(0);
  });
});
