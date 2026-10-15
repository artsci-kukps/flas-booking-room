'use client';

import { createSupabaseClient } from '@/app/config/supabase-client';
export default function LoginPage() {
  const supabase = createSupabaseClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // ส่งกลับมาที่ไฟล์ Callback ในขั้นตอนที่ 1
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <button
        onClick={handleGoogleLogin}
        className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 flex items-center gap-3 font-medium"
      >
        <img
          src="https://www.svgrepo.com/show/475656/google-color.svg"
          alt="Google"
          className="w-5 h-5"
        />
        Sign in with Google
      </button>
    </div>
  );
}