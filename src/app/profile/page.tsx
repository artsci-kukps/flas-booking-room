import { createSupabaseServerClient } from '@/app/config/supabase-server'
import SignOutButton from './signOutBtn'
export default async function HomePage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <main className="p-8">
            {user ? (
                <div>
                    <h1>ยินดีต้อนรับ!</h1>
                    <p>Email: {user.email}</p>
                    <p>ชื่อ: {user.user_metadata?.full_name}</p>
                    <p>รูปภาพ: {user.user_metadata?.avatar_url}</p>
                    {user.user_metadata?.avatar_url && (
                        <img
                            src={user.user_metadata.avatar_url}
                            alt="Profile"
                            className="w-16 h-16 rounded-full mt-2"
                        />
                    )}
                    <SignOutButton />
                </div>
            ) : (
                <p>คุณยังไม่ได้เข้าสู่ระบบ</p>
            )}
        </main>
    );
}