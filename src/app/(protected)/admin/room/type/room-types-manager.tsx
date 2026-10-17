"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Alert from "@/components/alert";
import type { DeletedRoomTypeRow, RoomTypeRow } from "@/lib/admin/room-types";

import DeletedRoomTypes from "./deleted-room-types";
import RoomTypeForm from "./room-type-form";
import RoomTypesTable from "./room-types-table";

type RoomTypesManagerProps = {
  rows: RoomTypeRow[];
  deletedRows: DeletedRoomTypeRow[];
};

/**
 * ตัวจัดการหน้าประเภทห้อง — ถือสถานะว่าแถวใดกำลังแก้ไข และข้อความสำเร็จล่าสุด
 * ประกอบฟอร์มเพิ่ม/แก้ไข ตารางที่ใช้งาน และแผงรายการที่ถูกลบ จากข้อมูลชุดเดียวของเซิร์ฟเวอร์
 */
export default function RoomTypesManager({ rows, deletedRows }: RoomTypesManagerProps) {
  const [editingRow, setEditingRow] = useState<RoomTypeRow | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleResult = useCallback((message: string | null) => {
    setSuccess(message);
  }, []);

  const handleEdit = useCallback((row: RoomTypeRow) => {
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
          <RoomTypeForm
            key={editingRow.id}
            mode="edit"
            row={editingRow}
            onResult={handleResult}
            onCancel={handleCancel}
          />
        ) : (
          <RoomTypeForm key="create" mode="create" onResult={handleResult} />
        )}
      </div>

      <RoomTypesTable rows={rows} onEdit={handleEdit} />
      <DeletedRoomTypes rows={deletedRows} />
    </div>
  );
}
