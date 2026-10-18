"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";

import {
  confirmKeyPickupAction,
  confirmKeyReturnAction,
  type BookingKeyActionState,
} from "./key-actions";

const INITIAL_STATE: BookingKeyActionState = null;

type ConfirmTarget = "pickup" | "return" | null;

type BookingRowActionsProps = {
  row: AdminBookingRow;
  className?: string;
};

/**
 * ปุ่มยืนยันรับ–คืนกุญแจของการจองหนึ่งแถว (TOR ข้อ 8 · ticket #11)
 * - PENDING → ปุ่ม "ยืนยันรับกุญแจ" (→ ACTIVE)
 * - ACTIVE  → ปุ่ม "ยืนยันคืนกุญแจ" (→ COMPLETED/LATE_RETURN)
 * - สถานะอื่นไม่มีปุ่ม เพราะวงจรกุญแจจบแล้ว
 * ยืนยันก่อนทำเสมอ และใช้ useActionState เพื่อปิดปุ่มระหว่างบันทึก + แสดงข้อผิดพลาด inline
 * (การกันรับซ้ำ/คืนซ้ำจริงอยู่ที่เงื่อนไขสถานะในชั้นข้อมูล)
 */
export default function BookingRowActions({ row, className }: BookingRowActionsProps) {
  const [pickupState, pickupAction, pickupPending] = useActionState(
    confirmKeyPickupAction,
    INITIAL_STATE,
  );
  const [returnState, returnAction, returnPending] = useActionState(
    confirmKeyReturnAction,
    INITIAL_STATE,
  );
  const [confirming, setConfirming] = useState<ConfirmTarget>(null);

  const wrapperClass = `flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`;

  const successMessage =
    pickupState?.ok === true
      ? "ยืนยันรับกุญแจแล้ว — สถานะเป็นกำลังใช้งาน"
      : returnState?.ok === true
        ? returnState.status === "LATE_RETURN"
          ? "ยืนยันคืนกุญแจแล้ว — คืนช้ากว่ากำหนด"
          : "ยืนยันคืนกุญแจแล้ว — คืนตรงเวลา"
        : null;

  if (row.status !== "PENDING" && row.status !== "ACTIVE") {
    return successMessage ? (
      <div className={wrapperClass}>
        <Alert tone="success" heading={successMessage} className="w-full" />
      </div>
    ) : (
      <span className="text-sm text-ink-muted">—</span>
    );
  }

  const isPickup = row.status === "PENDING";
  const pending = isPickup ? pickupPending : returnPending;
  const state = isPickup ? pickupState : returnState;

  if (confirming !== null) {
    const confirmingPickup = confirming === "pickup";

    return (
      <div className={wrapperClass}>
        <span className="text-sm text-ink">
          {confirmingPickup
            ? "ยืนยันรับกุญแจรายการนี้หรือไม่?"
            : "ยืนยันคืนกุญแจรายการนี้หรือไม่?"}
        </span>
        <form action={confirmingPickup ? pickupAction : returnAction}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            disabled={
              confirmingPickup ? pickupPending : returnPending
            }
            aria-busy={confirmingPickup ? pickupPending : returnPending}
            className="btn btn-sm btn-primary whitespace-nowrap"
          >
            {(confirmingPickup ? pickupPending : returnPending) ? "กำลังบันทึก…" : "ยืนยัน"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          disabled={confirmingPickup ? pickupPending : returnPending}
          className="btn btn-sm btn-outline whitespace-nowrap"
        >
          ยกเลิก
        </button>
        {state && !state.ok ? (
          <Alert tone="danger" heading={state.message} className="w-full" />
        ) : null}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={() => setConfirming(isPickup ? "pickup" : "return")}
        disabled={pending}
        aria-busy={pending}
        className="btn btn-sm btn-outline whitespace-nowrap"
      >
        {pending ? "กำลังบันทึก…" : isPickup ? "ยืนยันรับกุญแจ" : "ยืนยันคืนกุญแจ"}
      </button>
      {state && !state.ok ? (
        <Alert tone="danger" heading={state.message} className="w-full" />
      ) : null}
      {successMessage ? (
        <Alert tone="success" heading={successMessage} className="w-full" />
      ) : null}
    </div>
  );
}
