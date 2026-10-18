"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";

import { cancelBooking, type CancelActionState } from "./actions";

const INITIAL_STATE: CancelActionState = null;

/**
 * ปุ่มยกเลิกการจองของตัวเองหนึ่งรายการ — แสดงเฉพาะแถวที่ยกเลิกได้ (PENDING ก่อนเวลาเริ่ม)
 * มีขั้นยืนยันก่อนส่ง เพราะยกเลิกแล้วแก้ไขไม่ได้ (TOR ข้อ 6.4: ต้องยกเลิกแล้วจองใหม่)
 * กติกาทั้งหมดอยู่ที่ server action — ที่นี่แค่ยืนยันและส่ง id
 */
export default function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(cancelBooking, INITIAL_STATE);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="btn btn-sm btn-danger whitespace-nowrap"
        >
          ยกเลิกการจอง
        </button>
        {state && !state.ok ? (
          <Alert tone="danger" heading={state.message} className="w-full" />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-ink">ยืนยันยกเลิกการจองนี้?</span>
      <form action={action}>
        <input type="hidden" name="id" value={bookingId} />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-sm btn-danger whitespace-nowrap"
        >
          {pending ? "กำลังยกเลิก…" : "ยืนยัน"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setIsConfirming(false)}
        disabled={pending}
        className="btn btn-sm btn-outline whitespace-nowrap"
      >
        ไม่ยกเลิก
      </button>
      {state && !state.ok ? (
        <Alert tone="danger" heading={state.message} className="w-full" />
      ) : null}
    </div>
  );
}
