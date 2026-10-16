import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/config/supabase-server";
import { isKuEmail } from "@/lib/auth/ku-email";
import db from "@/db";
import { users } from "@/db/schema";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile"; // หน้าที่จะส่งไปหลังจากล็อกอินสำเร็จ (เช่น หน้าแรก /)

  if (code) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // ชั้นที่ 2: ตรวจ suffix @ku.th ที่ server ก่อนเขียนลง DB เสมอ
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // ไม่มี session user ให้ถือว่าเข้าสู่ระบบไม่สำเร็จ
        return NextResponse.redirect(`${origin}/login?error=session`);
      }
      const email = user.email?.toLowerCase() ?? null;
      if (!isKuEmail(email)) {
        // บัญชี non-ku.th (หรือ provider ไม่ส่ง email มา): ปฏิเสธก่อนแตะ DB
        await supabase.auth.signOut(); // ล้างคุกกี้ session บน response ที่ redirect
        return NextResponse.redirect(`${origin}/login?error=ku-domain`);
      }
      // บันทึก/อัปเดตข้อมูลลงตาราง public.users ของเรา (Upsert) — email ผ่านการตรวจแล้ว
      await db
        .insert(users)
        .values({
          id: user.id, // ใช้ ID เดียวกับ auth.users ของ Supabase (UUID)
          email: email!,
          fullName: user.user_metadata?.full_name || "",
          imageUrl: user.user_metadata?.avatar_url || "",
        })
        .onConflictDoUpdate({
          target: users.id, // ถ้ามี ID นี้ในตารางแล้ว ให้ทำการ อัปเดต ข้อมูลแทน
          set: {
            fullName: user.user_metadata?.full_name || "",
            imageUrl: user.user_metadata?.avatar_url || "",
          },
        });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // หากเกิดข้อผิดพลาด ให้กลับไปหน้าเข้าสู่ระบบ
  return NextResponse.redirect(`${origin}/login?error=session`);
}
