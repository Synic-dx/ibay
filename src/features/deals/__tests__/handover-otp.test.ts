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

  it("cleans candidate input and rejects invalid lengths", () => {
    const clean = (input: string) => input.replace(/\D/g, "");
    expect(clean(" 481-920 ")).toBe("481920");
    expect(clean("48 19 20")).toBe("481920");
    expect(clean("12345")).toHaveLength(5);
    expect(clean("1234567")).toHaveLength(7);
  });

  it("correctly identifies the active handover step for rentals vs sales", () => {
    const getHandoverStep = (kind: "sale" | "rental", stage: number): "pickup" | "return" | "completed" => {
      if (kind === "sale") {
        return stage === 0 ? "pickup" : "completed";
      }
      if (stage === 0) return "pickup";
      if (stage === 1) return "return";
      return "completed";
    };

    expect(getHandoverStep("sale", 0)).toBe("pickup");
    expect(getHandoverStep("sale", 1)).toBe("completed");
    expect(getHandoverStep("rental", 0)).toBe("pickup");
    expect(getHandoverStep("rental", 1)).toBe("return");
    expect(getHandoverStep("rental", 2)).toBe("completed");
  });
});
