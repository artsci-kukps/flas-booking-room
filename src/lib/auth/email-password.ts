import type { AlertTone } from "@/components/alert";
import { isKuEmail } from "@/lib/auth/ku-email";

/**
 * กติกากลางของการเข้าสู่ระบบ/สมัครสมาชิกด้วยอีเมล–รหัสผ่าน
 * ไฟล์นี้ต้อง import ได้ทั้งฝั่ง client และ server (ไม่พึ่ง node:crypto)
 * ค่าคงที่และตัวตรวจทั้งหมดจึงอยู่ที่เดียว เพื่อให้ UI กับ server action ตรงกันเสมอ
 */

/** จำนวนหลักของรหัส OTP ที่ส่งทางอีเมล */
export const OTP_LENGTH = 6;
/** อายุของรหัส OTP (วินาที) — ใช้ทั้งฝั่ง UI (นับถอยหลัง) และ TTL ใน Redis */
export const OTP_TTL_SECONDS = 10 * 60;
/** ระยะห่างขั้นต่ำก่อนกดขอรหัสซ้ำได้อีกครั้ง (วินาที) */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** จำนวนครั้งสูงสุดที่ขอรหัสได้ต่ออีเมลหนึ่ง (ในหน้าต่าง OTP_SENDS_WINDOW_SECONDS) */
export const OTP_MAX_SENDS = 5;
/** จำนวนครั้งสูงสุดที่กรอกรหัสผิด ก่อนต้องขอรหัสใหม่ */
export const OTP_MAX_ATTEMPTS = 5;
/** ความยาวขั้นต่ำของรหัสผ่าน */
export const PASSWORD_MIN_LENGTH = 8;
/** หน้าต่างเวลาที่นับจำนวนครั้งการขอรหัส (วินาที) */
export const OTP_SENDS_WINDOW_SECONDS = 60 * 60;

export type AuthField = "email" | "password" | "otp";

/** ข้อความแจ้งเตือนที่ส่งกลับไปแสดงในการ์ด (สอดคล้องกับ Global Alert) */
export type AuthAlert = {
  heading: string;
  body: string;
  /** ช่องที่ควรพาผู้ใช้กลับไปแก้ (ถ้ามี) */
  field?: AuthField;
  /** โทนของ Alert — ไม่ระบุ = danger (กรณีผิดพลาด ซึ่งเป็นค่าส่วนใหญ่) */
  tone?: AlertTone;
};

export type AuthResult = { ok: true } | { ok: false; error: AuthAlert };

/** สร้างผลลัพธ์แบบผิดพลาด ให้รูปเดียวกันทั้งไฟล์ */
export function authFail(
  heading: string,
  body: string,
  field?: AuthField,
): AuthResult {
  return { ok: false, error: { heading, body, field } };
}

/** อีเมล normalize แบบเดียวกับที่ทุกชั้นใช้: trim + ตัวพิมพ์เล็ก */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** คืนข้อความอธิบายถ้าอีเมลยังใช้ไม่ได้ — คืน null เมื่อผ่าน */
export function emailProblem(email: string): string | null {
  if (!email) {
    return "กรุณากรอกอีเมลมหาวิทยาลัยของคุณ";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
  }

  if (!isKuEmail(email)) {
    return "ระบบอนุญาตเฉพาะอีเมลที่ลงท้ายด้วย @ku.th เท่านั้น";
  }

  return null;
}

/** คืนข้อความอธิบายถ้ารหัสผ่านยังใช้ไม่ได้ — คืน null เมื่อผ่าน */
export function passwordProblem(password: string): string | null {
  if (!password) {
    return "กรุณาตั้งรหัสผ่าน";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
  }

  return null;
}

/** คีย์ใน Redis ของการสมัครสมาชิกหนึ่งอีเมล — รวมไว้ที่เดียวเพื่อไม่ให้พิมพ์ผิดกันหลายที่ */
export function otpRedisKeys(email: string) {
  const base = `register:${email}`;
  return {
    /** เก็บผลแฮชของรหัส + จำนวนครั้งที่กรอกผิด (JSON) */
    otpKey: `${base}:otp`,
    /** มีอยู่ = ยังอยู่ในช่วงห้ามขอรหัสซ้ำ (cooldown) */
    cooldownKey: `${base}:otp:cooldown`,
    /** ตัวนับจำนวนครั้งที่ขอรหัสในหน้าต่างเวลาที่กำหนด */
    sendsKey: `${base}:otp:sends`,
  };
}

/** รูปแบบเวลาถอยหลังแบบสั้น เช่น 59 → "0:59" (ใช้ใต้ปุ่มส่งรหัสอีกครั้ง) */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
