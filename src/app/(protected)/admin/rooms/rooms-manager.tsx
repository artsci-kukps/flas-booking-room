"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Alert from "@/components/alert";
import type { AdminRoomRow, DeletedRoomRow } from "@/lib/admin/rooms";
import type { RoomTypeRow } from "@/lib/admin/room-types";

import DeletedRooms from "./deleted-rooms";
import RoomForm from "./room-form";
import RoomsTable from "./rooms-table";

type RoomsManagerProps = {
  rows: AdminRoomRow[];
  deletedRows: DeletedRoomRow[];
  roomTypes: RoomTypeRow[];
};

/**
 * ตัวจัดการหน้าห้อง — ถือสถานะว่าแถวใดกำลังแก้ไข และข้อความสำเร็จล่าสุด
 * ประกอบฟอร์มเพิ่ม/แก้ไข ตารางที่ใช้งาน และแผงรายการที่ถูกลบ จากข้อมูลชุดเดียวของเซิร์ฟเวอร์
 */
export default function RoomsManager({ rows, deletedRows, roomTypes }: RoomsManagerProps) {
  const [editingRow, setEditingRow] = useState<AdminRoomRow | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // เพิ่มขึ้นเมื่อบันทึกสำเร็จ เพื่อ remount ฟอร์มเพิ่มห้องและล้างค่า (รวม dropdown ที่ถูกควบคุม)
  const [formVersion, setFormVersion] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  const handleResult = useCallback((message: string | null) => {
    setSuccess(message);

    if (message !== null) {
      setFormVersion((version) => version + 1);
    }
  }, []);

  const handleEdit = useCallback((row: AdminRoomRow) => {
    setSuccess(null);
    setEditingRow(row);
  }, []);

  const handleCancel = useCallback(() => setEditingRow(null), []);

  useEffect(() => {
    if (editingRow) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editingRow]);

  return (
    <div className="mt-6 grid gap-6">
      <div ref={formRef} className="scroll-mt-6">
        {success ? <Alert tone="success" heading={success} className="mb-3" /> : null}

        {editingRow ? (
          <RoomForm
            key={editingRow.id}
            mode="edit"
            row={editingRow}
            roomTypes={roomTypes}
            onResult={handleResult}
            onCancel={handleCancel}
          />
        ) : (
          <RoomForm
            key={`create-${formVersion}`}
            mode="create"
            roomTypes={roomTypes}
            onResult={handleResult}
          />
        )}
      </div>

      <RoomsTable rows={rows} onEdit={handleEdit} />
      <DeletedRooms rows={deletedRows} />
    </div>
  );
}
