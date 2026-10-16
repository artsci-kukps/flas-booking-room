import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        ผู้ดูแลระบบ
      </h1>
      <p className="mt-2 text-ink-muted">
        ยินดีต้อนรับ {admin.fullName ?? admin.email} —
        คุณเข้าถึงหน้าผู้ดูแลระบบได้
      </p>
    </main>
  );
}
