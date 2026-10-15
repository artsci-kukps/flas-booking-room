'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/app/config/supabase-client';

export default function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();
        router.refresh(); // รีเฟรชหน้า Server Component เพื่ออัปเดตสถานะ
    };

    return (
        <button
            onClick={handleSignOut}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
            ออกจากระบบ
        </button>
    );
}