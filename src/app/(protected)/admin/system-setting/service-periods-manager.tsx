"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Alert from "@/components/alert";
import type { ServicePeriodRow } from "@/lib/admin/service-periods";

import ServicePeriodForm from "./service-period-form";
import ServicePeriodsTable from "./service-periods-table";

type ServicePeriodsManagerProps = {
  rows: ServicePeriodRow[];
  /** วันปัจจุบัน YYYY-MM-DD (เซิร์ฟเวอร์คำนวณด้วยเขตเวลา Asia/Bangkok) */
  today: string;
};

/**
 * ตัวจัดการหน้าตั้งค่าเวลาให้บริการ — ถือสถานะว่าแถวกำลังแก้ไข และข้อความสำเร็จล่าสุด
 * ประกอบฟอร์มเพิ่ม/แก้ไข และตารางที่ใช้งาน จากข้อมูลชุดเดียวของเซิร์ฟเวอร์
 */
export default function ServicePeriodsManager({ rows, today }: ServicePeriodsManagerProps) {
  const [editingRow, setEditingRow] = useState<ServicePeriodRow | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleResult = useCallback((message: string | null) => {
    setSuccess(message);
  }, []);

  const handleEdit = useCallback((row: ServicePeriodRow) => {
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
          <ServicePeriodForm
            key={editingRow.id}
            mode="edit"
            row={editingRow}
            onResult={handleResult}
            onCancel={handleCancel}
          />
        ) : (
          <ServicePeriodForm key="create" mode="create" onResult={handleResult} />
        )}
      </div>

      <ServicePeriodsTable rows={rows} today={today} onEdit={handleEdit} />
    </div>
  );
}
