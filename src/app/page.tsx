import { redirect } from 'next/navigation';

// หน้าแรกสุดเป็นเพียงทางผ่านไปยังหน้าเข้าสู่ระบบ
export default function Home() {
  redirect('/login');
}
