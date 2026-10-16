import Link from "next/link";

// หน้าแรกสุดเป็นเพียงทางผ่านไปยังหน้า Dashboard
export default function UserHome() {
  return (
    <div>
      User Dashboard <Link href={"/user/profile"}></Link>
    </div>
  );
}
