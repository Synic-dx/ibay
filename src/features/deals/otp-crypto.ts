import crypto from "crypto";

/**
 * Generates a cryptographically random 6-digit numeric OTP (100000 - 999999).
 */
export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Computes SHA-256 hash of an OTP string.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

/**
 * Validates candidate OTP against a stored SHA-256 hash.
 */
export function verifyOtpHash(candidate: string, storedHash: string): boolean {
  if (!candidate || candidate.trim().length !== 6) return false;
  const candidateHash = hashOtp(candidate);
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));
}
