"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/app/config/supabase-admin";
import { createSupabaseServerClient } from "@/app/config/supabase-server";
import db from "@/db";
import { users } from "@/db/schema";
import {
  authFail,
  emailProblem,
  formatCountdown,
  normaliseEmail,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_SENDS_WINDOW_SECONDS,
  OTP_TTL_SECONDS,
  otpRedisKeys,
  passwordProblem,
  type AuthResult,
} from "@/lib/auth/email-password";
import { generateOtp, hashOtp, verifyOtp } from "@/lib/auth/otp-crypto";
import { sendEmail } from "@/services/email.service";
import { renderOtpEmail } from "@/services/emails/otp";
import {
  delRedis,
  getRedis,
  incrRedis,
  setRedis,
  ttlRedis,
} from "@/services/redis.service";
import { error } from "node:console";

/** รูปร่างเท่าที่เราต้องใช้จากผู้ใช้ Supabase — ไม่ผูกกับ type ภายในของไลบรารี */
type SupabaseUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type OtpRecord = {
  /** sha256 ของรหัส — ไม่เก็บรหัสจริง */
  hash: string;
  attempts: number;
};

const OTP_DIGITS = /^\d+$/;

/**
 * บันทึก/อัปเดตแถวใน public.users ให้ตรงกับผู้ใช้ Supabase (Upsert)
 * คืน role ปัจจุบันเพื่อใช้ตัดสินปลายทางหลังเข้าสู่ระบบ
 */
async function persistUser(
  user: SupabaseUserLike,
  options: { touchLogin: boolean },
): Promise<"user" | "admin"> {
  const email = (user.email ?? "").toLowerCase();
  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : "";
  const imageUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : "";
  const lastLoginAt = options.touchLogin ? new Date() : undefined;

  const [row] = await db
    .insert(users)
    .values({
      id: user.id,
      email,
      fullName,
      imageUrl,
      ...(lastLoginAt ? { lastLoginAt } : {}),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        fullName,
        imageUrl,
        ...(lastLoginAt ? { lastLoginAt } : {}),
      },
    })
    .returning({ role: users.role });

  return row?.role ?? "user";
}

/** ปลายทางถัดไปหลังเข้าสู่ระบบสำเร็จ — แยกพื้นที่ตามบทบาท */
function destinationFor(role: "user" | "admin"): string {
  return role === "admin" ? "/admin/dashboard" : "/user/booking";
}

/**
 * เข้าสู่ระบบด้วยอีเมล + รหัสผ่าน (@ku.th เท่านั้น)
 * สำเร็จแล้ว redirect ทันที จึงคืนค่าเฉพาะกรณีผิดพลาดให้ UI แสดง Alert
 */
export async function signInWithEmailAndPassword(authData: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = normaliseEmail(authData.email);

  const emailIssue = emailProblem(email);
  if (emailIssue) {
    return authFail("เข้าสู่ระบบไม่ได้", emailIssue, "email");
  }

  if (!authData.password) {
    return authFail("เข้าสู่ระบบไม่ได้", "กรุณากรอกรหัสผ่าน", "password");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: authData.password,
  });

  if (error || !data.user) {
    return authFail(
      "เข้าสู่ระบบไม่สำเร็จ",
      "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่อีกครั้ง",
      "password",
    );
  }

  const role = await persistUser(data.user, { touchLogin: true });
  redirect(destinationFor(role));
}

/**
 * ขั้นที่ 1 ของการสมัครสมาชิก: ตรวจอีเมล @ku.th แล้วส่งรหัส OTP ทางอีเมล
 * เก็บเฉพาะแฮชของรหัสลง Redis พร้อมคูลดาวน์และเพดานจำนวนครั้ง
 */
export async function requestOTPforRegister(
  email: string,
): Promise<AuthResult> {
  const value = normaliseEmail(email);

  const emailIssue = emailProblem(value);
  if (emailIssue) {
    return authFail("ขอรหัสไม่สำเร็จ", emailIssue, "email");
  }

  // มีแถวในตาราง users แล้ว = เคยเข้าสู่ระบบ (Google หรือรหัสผ่าน) มาก่อน
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, value))
    .limit(1);

  if (existing) {
    return authFail(
      "อีเมลนี้มีบัญชีอยู่แล้ว",
      "กรุณาเข้าสู่ระบบด้วยวิธีเดิมของอีเมลนี้ (Google หรืออีเมล–รหัสผ่าน) แทนการสมัครใหม่",
      "email",
    );
  }

  const keys = otpRedisKeys(value);

  const cooldown = await ttlRedis(keys.cooldownKey);
  if (cooldown > 0) {
    return authFail(
      "ยังขอรหัสซ้ำไม่ได้",
      `รหัสถูกส่งไปแล้ว กรุณารออีก ${formatCountdown(cooldown)} แล้วลองใหม่`,
      "email",
    );
  }

  const sends = await incrRedis(keys.sendsKey, OTP_SENDS_WINDOW_SECONDS);
  if (sends > OTP_MAX_SENDS) {
    return authFail(
      "ขอรหัสบ่อยเกินไป",
      `ขอรหัสได้ไม่เกิน ${OTP_MAX_SENDS} ครั้งต่อชั่วโมง กรุณาลองใหม่ภายหลัง`,
      "email",
    );
  }

  const code = generateOtp();

  await setRedis<OtpRecord>(
    keys.otpKey,
    { hash: hashOtp(code), attempts: 0 },
    OTP_TTL_SECONDS,
  );
  await setRedis(keys.cooldownKey, true, OTP_RESEND_COOLDOWN_SECONDS);

  try {
    await sendEmail({ to: value, ...renderOtpEmail({ code }) });
  } catch {
    // ส่งไม่ออก = อย่าให้ผู้ใช้ติดคูลดาวน์หรือมีรหัสค้างที่ใช้ไม่ได้
    await delRedis(keys.otpKey);
    await delRedis(keys.cooldownKey);
    return authFail(
      "ส่งรหัสไม่สำเร็จ",
      "ระบบส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      "email",
    );
  }

  return { ok: true };
}

/**
 * ขั้นที่ 2 ของการสมัครสมาชิก: ยืนยันรหัส OTP แล้วสร้างบัญชี Supabase (ยืนยันอีเมลให้เลย)
 * จากนั้นเข้าสู่ระบบอัตโนมัติด้วยรหัสผ่านที่ตั้งไว้ แล้ว redirect เข้าหน้าจองห้อง
 */
export async function signUpWithEmailAndPassword(authData: {
  email: string;
  password: string;
  otp: string;
}): Promise<AuthResult> {
  const email = normaliseEmail(authData.email);

  const emailIssue = emailProblem(email);
  if (emailIssue) {
    return authFail("สมัครสมาชิกไม่สำเร็จ", emailIssue, "email");
  }

  const passwordIssue = passwordProblem(authData.password);
  if (passwordIssue) {
    return authFail("สมัครสมาชิกไม่สำเร็จ", passwordIssue, "password");
  }

  const keys = otpRedisKeys(email);
  const record = await getRedis<OtpRecord>(keys.otpKey);
  const candidate = authData.otp.trim();

  if (!record) {
    return authFail(
      "รหัสยืนยันใช้ไม่ได้แล้ว",
      "รหัสหมดอายุหรือถูกใช้ไปแล้ว กรุณากดขอรหัสใหม่",
      "otp",
    );
  }

  if (
    candidate.length !== 6 ||
    !OTP_DIGITS.test(candidate) ||
    !verifyOtp(candidate, record.hash)
  ) {
    const attempts = record.attempts + 1;

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await delRedis(keys.otpKey);
      return authFail(
        "รหัสไม่ถูกต้องหลายครั้ง",
        "เพื่อความปลอดภัย กรุณากดขอรหัสยืนยันใหม่",
        "otp",
      );
    }

    // เขียนจำนวนครั้งกลับโดยรักษาเวลาหมดอายุเดิมไว้
    const remaining = await ttlRedis(keys.otpKey);
    await setRedis<OtpRecord>(
      keys.otpKey,
      { hash: record.hash, attempts },
      remaining > 0 ? remaining : OTP_TTL_SECONDS,
    );

    return authFail(
      "รหัสไม่ถูกต้อง",
      `รหัสยืนยันไม่ถูกต้อง เหลือโอกาสอีก ${OTP_MAX_ATTEMPTS - attempts} ครั้ง`,
      "otp",
    );
  }

  let createdUserId: string | null = null;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: authData.password,
      // เรายืนยันอีเมลด้วย OTP ของระบบเองแล้ว จึงไม่ต้องให้ Supabase ส่งอีเมลยืนยันอีก
      email_confirm: true,
    });

    if (!error && data.user) {
      createdUserId = data.user.id;
    } else {
      const alreadyRegistered = /already|registered|exists/i.test(
        error?.message ?? "",
      );

      return authFail(
        "สมัครสมาชิกไม่สำเร็จ",
        alreadyRegistered
          ? "อีเมลนี้ถูกสมัครไว้แล้ว กรุณาเข้าสู่ระบบแทน"
          : "ระบบสร้างบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        "email",
      );
    }
  } catch {
    return authFail(
      "สมัครสมาชิกไม่สำเร็จ",
      "ระบบสร้างบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      "email",
    );
  }

  await delRedis(keys.otpKey);
  await persistUser(
    { id: createdUserId, email, user_metadata: { full_name: "" } },
    { touchLogin: true },
  );

  // เข้าสู่ระบบอัตโนมัติเพื่อให้ได้ session cookie — ถ้าล้มเหลวจึงให้กลับไปเข้าสู่ระบบเอง
  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: authData.password,
  });

  // สมัครสำเร็จแต่ได้ session ไม่ครบ ถือว่าเข้าสู่ระบบไม่สำเร็จ
  // พากลับหน้าเข้าสู่ระบบพร้อมประกาศ ?error=session (มีข้อความรออยู่แล้วที่หน้า login)
  if (signInError) {
    redirect("/login?error=session");
  }

  redirect(destinationFor("user"));
}
