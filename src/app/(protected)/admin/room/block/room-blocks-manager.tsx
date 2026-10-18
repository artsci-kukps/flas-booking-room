"use client";

import { useCallback, useState } from "react";

import Alert from "@/components/alert";
import type { RoomBlockRow } from "@/lib/admin/room-blocks";
import type { AdminRoomRow } from "@/lib/admin/rooms";

import RoomBlockForm from "./room-block-form";
import RoomBlocksTable from "./room-blocks-table";

type RoomBlocksManagerProps = {
  rows: RoomBlockRow[];
  /** ห้องที่ยังใช้งานอยู่ สำหรับดรอปดาวน์ในฟอร์มเพิ่มบล็อก */
  rooms: AdminRoomRow[];
};

/**
 * ตัวจัดการหน้าบล็อกห้อง — ถือข้อความสำเร็จล่าสุด ประกอบฟอร์มเพิ่มบล็อก
 * และตารางรายการที่บล็อกอยู่จากข้อมูลชุดเดียวของเซิร์ฟเวอร์
 * (การลบทำ hard delete จึงไม่มีแผงรายการที่ถูกลบ)
 */
export default function RoomBlocksManager({ rows, rooms }: RoomBlocksManagerProps) {
  const [success, setSuccess] = useState<string | null>(null);

  const handleResult = useCallback((message: string | null) => {
    setSuccess(message);
  }, []);

  return (
    <div className="mt-6 grid gap-6">
      <div>
        {success ? <Alert tone="success" heading={success} className="mb-3" /> : null}
        <RoomBlockForm rooms={rooms} onResult={handleResult} />
      </div>

      <RoomBlocksTable rows={rows} />
    </div>
  );
}
