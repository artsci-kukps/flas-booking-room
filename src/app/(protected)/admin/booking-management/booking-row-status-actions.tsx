"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";
import {
  RESERVATION_STATUS_LABEL,
  RESERVATION_STATUSES,
} from "@/lib/booking/reservation-status";

import {
  cancelReservationAction,
  overrideReservationStatusAction,
  type BookingCancelOverrideActionState,
} from "./cancel-override-actions";

const INITIAL_STATE: BookingCancelOverrideActionState = null;

type Mode = "cancel" | "override" | null;

type BookingRowStatusActionsProps = {
  row: AdminBookingRow;
  className?: string;
};

/**
 * ปุ่มยกเลิก/แก้ไขสถานะของการจองหนึ่งแถว (TOR ข้อ 6.4/7 · ticket #12)
 * - ยกเลิกได้ทุกสถานะ ต้องระบุเหตุผล → CANCELLED (ช่องว่างถูกปลดล็อกทันที)
 * - แก้ไขสถานะได้เสมอเมื่อระบบตั้งผิด เช่น NO_SHOW → ACTIVE พร้อมเหตุผล
 * ยืนยันในฟอร์มเดียวกับเหตุผล และใช้ useActionState ปิดปุ่มระหว่างบันทึก + แสดงข้อผิดพลาด inline
 */
export default function BookingRowStatusActions({ row, className }: BookingRowStatusActionsProps) {
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelReservationAction,
    INITIAL_STATE,
  );
  const [overrideState, overrideAction, overridePending] = useActionState(
    overrideReservationStatusAction,
    INITIAL_STATE,
  );
  const [mode, setMode] = useState<Mode>(null);

  const wrapperClass = `flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`;

  const successMessage = cancelState?.ok
    ? "ยกเลิกการจองแล้ว — ช่องว่างถูกปลดล็อกให้จองทับได้"
    : overrideState?.ok
      ? `แก้ไขสถานะเป็น “${RESERVATION_STATUS_LABEL[overrideState.status]}” แล้ว`
      : null;

  const state = mode === "cancel" ? cancelState : mode === "override" ? overrideState : null;
  const pending = mode === "cancel" ? cancelPending : mode === "override" ? overridePending : false;

  if (mode === null) {
    return (
      <div className={wrapperClass}>
        <button
          type="button"
          onClick={() => setMode("override")}
          className="btn btn-sm btn-outline whitespace-nowrap"
        >
          แก้ไขสถานะ
        </button>
        <button
          type="button"
          onClick={() => setMode("cancel")}
          className="btn btn-sm btn-outline whitespace-nowrap"
        >
          ยกเลิกการจอง
        </button>
        {successMessage ? (
          <Alert tone="success" heading={successMessage} className="w-full" />
        ) : null}
      </div>
    );
  }

  if (mode === "cancel") {
    return (
      <div className={wrapperClass}>
        <form action={cancelAction} className="flex w-full flex-col items-end gap-2">
          <input type="hidden" name="id" value={row.id} />
          <label htmlFor={`${row.id}-cancel-reason`} className="field-label w-full text-right">
            เหตุผลการยกเลิก
            <input
              id={`${row.id}-cancel-reason`}
              name="reason"
              type="text"
              required
              maxLength={500}
              placeholder="เช่น ผู้ใช้โทรขอยกเลิก"
              className="field mt-1 w-full"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(null)} disabled={pending} className="btn btn-sm btn-outline whitespace-nowrap">
              ปิด
            </button>
            <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-sm btn-danger whitespace-nowrap">
              {cancelPending ? "กำลังบันทึก…" : "ยืนยันยกเลิก"}
            </button>
          </div>
        </form>
        {state && !state.ok ? (
          <Alert tone="danger" heading={state.message} className="w-full" />
        ) : null}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <form action={overrideAction} className="flex w-full flex-col items-end gap-2">
        <input type="hidden" name="id" value={row.id} />
        <label htmlFor={`${row.id}-override-status`} className="field-label w-full text-right">
          สถานะใหม่
          <select
            id={`${row.id}-override-status`}
            name="status"
            defaultValue={row.status}
            className="field-select mt-1 w-full"
          >
            {RESERVATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {RESERVATION_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${row.id}-override-reason`} className="field-label w-full text-right">
          เหตุผลการแก้ไขสถานะ
          <input
            id={`${row.id}-override-reason`}
            name="reason"
            type="text"
            required
            maxLength={500}
            placeholder="เช่น ระบบตั้ง NO_SHOW ผิด ผู้ใช้มารับกุญแจแล้ว"
            className="field mt-1 w-full"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode(null)} disabled={pending} className="btn btn-sm btn-outline whitespace-nowrap">
            ปิด
          </button>
          <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-sm btn-primary whitespace-nowrap">
            {overridePending ? "กำลังบันทึก…" : "บันทึกสถานะ"}
          </button>
        </div>
      </form>
      {state && !state.ok ? (
        <Alert tone="danger" heading={state.message} className="w-full" />
      ) : null}
    </div>
  );
}
