"use client";

import { useRouter } from "next/navigation";

import { createSupabaseClient } from "@/app/config/supabase-client";

type SignOutButtonProps = {
  /** "icon" ใช้บนหัวกระดาษ, "labeled" ใช้เป็นปุ่มเต็มในหน้าโปรไฟล์ */
  variant?: "icon" | "labeled";
  /** ชั้นคลาสเพิ่มเติมจากผู้เรียก เช่น w-full ในแถบข้าง */
  className?: string;
};

export default function SignOutButton({
  variant = "icon",
  className,
}: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const icon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className={`btn btn-outline${className ? ` ${className}` : ""}`}
      >
        {icon}
        ออกจากระบบ
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="ออกจากระบบ"
      title="ออกจากระบบ"
      className={`icon-btn${className ? ` ${className}` : ""}`}
    >
      {icon}
    </button>
  );
}
