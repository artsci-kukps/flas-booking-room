import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client ฝั่ง server ด้วย service role key — ใช้เฉพาะงานที่ anon client ทำไม่ได้
 * เช่น สร้างบัญชีพร้อมยืนยันอีเมล (`email_confirm: true`) เพราะเรายืนยันตัวตนด้วย OTP
 * ของระบบเองไปแล้ว ไม่ต้องให้ Supabase ส่งอีเมลยืนยันซ้ำ
 *
 * ห้ามนำ client นี้ไปใช้ในฝั่ง client เด็ดขาด
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ADMIN_KEY;

  if (!url || !key) {
    throw new Error("ไม่พบ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_ADMIN_KEY");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
