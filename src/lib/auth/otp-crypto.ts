import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { OTP_LENGTH } from "@/lib/auth/email-password";

/**
 * ตัวช่วยเรื่องรหัส OTP ที่ต้องใช้ node:crypto — ใช้เฉพาะฝั่ง server เท่านั้น
 * เราเก็บแค่ "แฮช" ของรหัสลง Redis (ไม่เก็บรหัสจริง) และเทียบแบบ timing-safe
 */

/** สุ่มรหัสตัวเลขล้วนตามจำนวนหลักที่กำหนด (padding เป็นศูนย์นำหน้า) */
export function generateOtp(length: number = OTP_LENGTH): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, "0");
}

/** แฮชรหัสก่อนเก็บ — ไม่ต้องใช้ salt เพราะรหัสอายุสั้นและมีจำนวนจำกัด */
export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

/** เทียบรหัสกับแฮชที่เก็บไว้แบบคงเวลา (timing-safe) */
export function verifyOtp(otp: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(otp), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
