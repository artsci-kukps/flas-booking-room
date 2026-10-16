import { requireUser } from '@/lib/auth/guards'
import SignOutButton from './signOutBtn'

// ตรวจ session ตอน request-time — ปิด instant validation
export const instant = false;

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">ยินดีต้อนรับ!</h1>
      <p className="mt-2 text-ink-muted">Email: {user.email}</p>
      <p className="text-ink-muted">ชื่อ: {user.fullName}</p>
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt="Profile"
          className="mt-2 h-16 w-16 rounded-full"
        />
      ) : null}
      <SignOutButton />
    </main>
  );
}
