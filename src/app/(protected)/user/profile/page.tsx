import { requireUser } from "@/lib/auth/guards";

export default async function UserProfilePage() {
  const user = await requireUser();

  return (
    <div>
      User page {user.email} {user.fullName}
    </div>
  );
}
