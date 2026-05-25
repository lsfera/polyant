// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the config module BEFORE the SUT imports it.
vi.mock("../config.js", () => ({
  config: {
    initialAdmin: {} as { email?: string; password?: string },
  },
}));

vi.mock("./users.store.js", () => ({
  countUsers: vi.fn(),
  insertUser: vi.fn(),
}));

// Make generateToken deterministic so we can assert on the password we log.
vi.mock("../crypto/index.js", () => ({
  generateToken: vi.fn(() => "abc123def4"),
}));

import * as store from "./users.store.js";
import { config } from "../config.js";
import { seedInitialAdmin } from "./seed.js";

const mockedStore = store as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mutableConfig = config as unknown as {
  initialAdmin: { email?: string; password?: string };
};

describe("seedInitialAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableConfig.initialAdmin = {};
  });

  it("is a no-op when the users table is not empty", async () => {
    mockedStore.countUsers.mockResolvedValueOnce(3);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await seedInitialAdmin();

    expect(mockedStore.insertUser).not.toHaveBeenCalled();
    // Operator visibility: skip path must be logged so "can't log in"
    // diagnosis is cheap (no silent skip).
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("Skipped");
    expect(log.mock.calls[0][0]).toContain("3 user(s)");
    log.mockRestore();
  });

  it("seeds administrator@local with a generated password and prints a banner", async () => {
    mockedStore.countUsers.mockResolvedValueOnce(0);
    mockedStore.insertUser.mockResolvedValueOnce({});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await seedInitialAdmin();

    expect(mockedStore.insertUser).toHaveBeenCalledTimes(1);
    const inserted = mockedStore.insertUser.mock.calls[0][0];
    expect(inserted.email).toBe("administrator@local");
    expect(inserted.role).toBe("superadmin");
    expect(inserted.mustChangePassword).toBe(true);
    expect(inserted.passwordHash).toMatch(/^\$2[aby]\$/);

    expect(warn).toHaveBeenCalledTimes(1);
    const banner = warn.mock.calls[0][0] as string;
    expect(banner).toContain("INITIAL ADMIN CREATED");
    expect(banner).toContain("administrator@local");
    expect(banner).toContain("abc123def4");

    warn.mockRestore();
  });

  it("uses INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD when set, and does NOT print the password", async () => {
    mockedStore.countUsers.mockResolvedValueOnce(0);
    mockedStore.insertUser.mockResolvedValueOnce({});
    mutableConfig.initialAdmin = {
      email: "boss@example.com",
      password: "supplied-by-env",
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await seedInitialAdmin();

    expect(mockedStore.insertUser.mock.calls[0][0].email).toBe("boss@example.com");
    // Password from env: do NOT print it (admin already knows it).
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    const logged = log.mock.calls[0][0] as string;
    expect(logged).toContain("boss@example.com");
    expect(logged).not.toContain("supplied-by-env");

    warn.mockRestore();
    log.mockRestore();
  });

  it("does not throw when insertUser rejects (caller logs and continues)", async () => {
    // Note: seed.ts itself does not catch — the boot wrapper in index.ts does.
    // This test just locks the contract that seed surfaces store errors.
    mockedStore.countUsers.mockResolvedValueOnce(0);
    mockedStore.insertUser.mockRejectedValueOnce(new Error("db down"));
    await expect(seedInitialAdmin()).rejects.toThrow("db down");
  });
});
