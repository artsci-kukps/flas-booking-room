"use client";

import { useCallback, useState } from "react";

import Alert from "@/components/alert";

import HolidayForm from "./holiday-form";
import HolidaysTable from "./holidays-table";
import type { HolidayRow } from "@/lib/admin/holidays";

type HolidaysManagerProps = {
  rows: HolidayRow[];
};

/**
 * ตัวจัดการหน้าวันหยุด — ถือสถานะข้อความสำเร็จล่าสุด
 * ประกอบฟอร์มเพิ่มวันหยุด และตารางรายการที่แอดมินเพิ่มไว้
 */
export default function HolidaysManager({ rows }: HolidaysManagerProps) {
  const [success, setSuccess] = useState<string | null>(null);

  const handleResult = useCallback((message: string | null) => {
    setSuccess(message);
  }, []);

  return (
    <div className="mt-6 grid gap-6">
      <div>
        {success ? <Alert tone="success" heading={success} className="mb-3" /> : null}

        <HolidayForm onResult={handleResult} />
      </div>

      <HolidaysTable rows={rows} />
    </div>
  );
}
