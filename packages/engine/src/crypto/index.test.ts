// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { encrypt, decrypt } from "./index.js";

describe("crypto", () => {
  it("encrypts and decrypts a string round-trip", () => {
    const plaintext = "sk-my-secret-api-key-12345";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encrypt("test");
    const parts = ciphertext.split(":");
    parts[2] = "AAAA" + parts[2].slice(4);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("throws on invalid format", () => {
    expect(() => decrypt("not-valid-format")).toThrow();
  });

  it("encrypts and decrypts empty string", () => {
    const plaintext = "";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("encrypts and decrypts unicode/emoji content", () => {
    const plaintext = "Ciao mondo! 🚀🎉 日本語テスト Ñoño café ü";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("encrypts and decrypts very long string (10KB+)", () => {
    const plaintext = "A".repeat(10 * 1024 + 1);
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("throws on tampered IV", () => {
    const ciphertext = encrypt("test-iv-tamper");
    const parts = ciphertext.split(":");
    // Corrupt the IV
    const ivBuf = Buffer.from(parts[0], "base64");
    ivBuf[0] ^= 0xff;
    parts[0] = ivBuf.toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("throws on tampered auth tag", () => {
    const ciphertext = encrypt("test-tag-tamper");
    const parts = ciphertext.split(":");
    // Corrupt the auth tag
    const tagBuf = Buffer.from(parts[1], "base64");
    tagBuf[0] ^= 0xff;
    parts[1] = tagBuf.toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  // --- New tests ---

  it("property-based roundtrip: decrypt(encrypt(x)) === x for arbitrary strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 * 1024 }),
        (plaintext) => {
          const ciphertext = encrypt(plaintext);
          expect(decrypt(ciphertext)).toBe(plaintext);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("key rotation: decrypt with wrong key throws", async () => {
    const ciphertext = encrypt("secret-before-rotation");

    // Dynamically mock config to return a different key for decrypt
    const configModule = await import("../config.js");
    const originalKey = configModule.config.encryption.key;
    const wrongKey = "ab".repeat(32); // 64 hex chars = 32 bytes, different key

    configModule.config.encryption.key = wrongKey;
    try {
      expect(() => decrypt(ciphertext)).toThrow();
    } finally {
      configModule.config.encryption.key = originalKey;
    }
  });

  it("empty string roundtrip", () => {
    const ciphertext = encrypt("");
    expect(ciphertext).toBeTruthy();
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    expect(decrypt(ciphertext)).toBe("");
  });

  it("IV uniqueness: same plaintext produces different ciphertexts", () => {
    const plaintext = "identical-input";
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(encrypt(plaintext));
    }
    // All 50 ciphertexts must be unique (random IV)
    expect(results.size).toBe(50);
  });

  it("ciphertext truncation by 1 byte throws", () => {
    const ciphertext = encrypt("truncation-test");
    const parts = ciphertext.split(":");
    // Truncate the encrypted data portion by 1 byte
    const encBuf = Buffer.from(parts[2], "base64");
    const truncated = encBuf.subarray(0, encBuf.length - 1);
    parts[2] = truncated.toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("auth tag single bit-flip throws", () => {
    const ciphertext = encrypt("bit-flip-test");
    const parts = ciphertext.split(":");
    const tagBuf = Buffer.from(parts[1], "base64");
    // Flip the least significant bit of the last byte
    tagBuf[tagBuf.length - 1] ^= 0x01;
    parts[1] = tagBuf.toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("unicode stress: emoji, RTL (Arabic), CJK, surrogate pairs", () => {
    const cases = [
      "🚀🎉🌍💯🔥✨🎶🏆",
      "مرحبا بالعالم",
      "你好世界こんにちは세계",
      "𝕳𝖊𝖑𝖑𝖔 𝕿𝖊𝖘𝖙",
      "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}",
      "mixed: café naïve über Ñoño 日本 🏳️‍🌈",
      "𐐷𐐸𐑀𐑁", // Deseret script (surrogate pairs in UTF-16)
    ];
    for (const plaintext of cases) {
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    }
  });

  it("very large content: 100KB plaintext roundtrip", () => {
    const plaintext = "X".repeat(100 * 1024);
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });
});
