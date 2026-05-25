// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./password.util.js";

describe("password.util", () => {
  describe("validatePassword", () => {
    it("rejects passwords shorter than 8 chars", () => {
      const err = validatePassword("short");
      expect(err).not.toBeNull();
      expect(err?.code).toBe("too_short");
    });

    it("rejects empty string", () => {
      const err = validatePassword("");
      expect(err).not.toBeNull();
    });

    it("accepts an 8-character password", () => {
      expect(validatePassword("12345678")).toBeNull();
    });

    it("accepts a long passphrase", () => {
      expect(validatePassword("correct horse battery staple")).toBeNull();
    });
  });

  describe("hash + verify roundtrip", () => {
    it("verifies a hash for the original plaintext", async () => {
      const hash = await hashPassword("hunter22-secure");
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
      expect(await verifyPassword("hunter22-secure", hash)).toBe(true);
    });

    it("rejects a different plaintext against the same hash", async () => {
      const hash = await hashPassword("correct-password-1");
      expect(await verifyPassword("correct-password-2", hash)).toBe(false);
    });

    it("returns false for empty inputs", async () => {
      const hash = await hashPassword("password-1234");
      expect(await verifyPassword("", hash)).toBe(false);
      expect(await verifyPassword("password-1234", "")).toBe(false);
    });

    it("returns false for malformed hash (no exception)", async () => {
      expect(await verifyPassword("password-1234", "not-a-hash")).toBe(false);
    });

    it("produces different hashes for the same password (salt randomness)", async () => {
      const a = await hashPassword("same-password-99");
      const b = await hashPassword("same-password-99");
      expect(a).not.toBe(b);
      expect(await verifyPassword("same-password-99", a)).toBe(true);
      expect(await verifyPassword("same-password-99", b)).toBe(true);
    });
  });
});
