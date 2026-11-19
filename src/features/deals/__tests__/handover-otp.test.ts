import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, verifyOtpHash } from "../otp-crypto";

describe("Handover OTP Crypto & Validation", () => {
  it("generates a random 6-digit numeric OTP string", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
    const num = Number(otp);
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
  });

  it("hashes OTP consistently using SHA-256", () => {
    const otp = "481920";
    const hash1 = hashOtp(otp);
    const hash2 = hashOtp(otp);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string is 64 characters
  });

  it("verifies correct OTP against hash and rejects incorrect OTP", () => {
    const otp = "123456";
    const hash = hashOtp(otp);
    expect(verifyOtpHash("123456", hash)).toBe(true);
    expect(verifyOtpHash("654321", hash)).toBe(false);
    expect(verifyOtpHash("12345", hash)).toBe(false);
  });
});
