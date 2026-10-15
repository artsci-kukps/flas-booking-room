import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/app/config/supabase-server';
import db from '@/db';
import { users } from '@/db/schema';


export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/profile'; // หน้าที่จะส่งไปหลังจากล็อกอินสำเร็จ (เช่น หน้าแรก /)

    if (code) {
        const supabase = await createSupabaseServerClient();

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            console.log('Login successful, redirecting to next page:', next);
            // บันทึก user ลง db
            const { data: { user } } = await supabase.auth.getUser();
            console.log('user', user);
            if (user) {
                //บันทึก/อัปเดตข้อมูลลงตาราง public.users ของเรา (Upsert)
                await db.insert(users).values({
                    id: user.id, // ใช้ ID เดียวกับ auth.users ของ Supabase (UUID)
                    email: user.email!,
                    fullName: user.user_metadata?.full_name || '',
                    imageUrl: user.user_metadata?.avatar_url || '',
                }).onConflictDoUpdate({
                    target: users.id, // ถ้ามี ID นี้ในตารางแล้ว ให้ทำการ อัปเดต ข้อมูลแทน
                    set: {
                        fullName: user.user_metadata?.full_name || '',
                        imageUrl: user.user_metadata?.avatar_url || '',
                    },
                });
            }
            return NextResponse.redirect(`${origin}${next}`);
        }

    }

    // หากเกิดข้อผิดพลาด ให้กลับไปหน้าเข้าสู่ระบบ หรือหน้า Error
    return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}