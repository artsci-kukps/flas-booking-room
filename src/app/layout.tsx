import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";

// ฟอนต์เดียวทั้งระบบ — Anuphan (ไทย + ละติน) แบบ variable รองรับน้ำหนัก 100–700
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบจองห้องทำงาน",
  description:
    "ระบบจองห้องทำงานรายชั่วโมง คณะศิลปศาสตร์และวิทยาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน สำหรับบุคลากรมหาวิทยาลัยเกษตรศาสตร์ (@ku.th)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${anuphan.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
