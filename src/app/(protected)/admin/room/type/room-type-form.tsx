"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import Alert from "@/components/alert";
import FieldSelect from "@/components/field-select";
import { BOOKING_MODE_LABEL } from "@/lib/admin/room-display";
import type { RoomTypeRow } from "@/lib/admin/room-types";

import { createRoomType, updateRoomType, type RoomTypeActionState } from "./actions";

const INITIAL_STATE: RoomTypeActionState = null;

type RoomTypeFormProps =
  | {
      mode: "create";
      /** แจ้งผลลัพธ์กลับไปให้หน้าจอ: ข้อความสำเร็จ หรือ null เมื่อล้มเหลว (ล้างข้อความเดิม) */
      onResult: (message: string | null) => void;
    }
  | {
      mode: "edit";
      row: RoomTypeRow;
      onResult: (message: string | null) => void;
      onCancel: () => void;
    };

/**
 * ฟอร์มเพิ่ม/แก้ไขประเภทห้อง — ใช้ useActionState สองตัว (เพิ่ม/แก้ไข) แล้วเลือกตามโหมด
 * สำเร็จสร้าง → ล้างฟอร์มและแจ้งเตือน; สำเร็จแก้ไข → คืนการควบคุมให้หน้าจอปิดฟอร์ม
 */
export default function RoomTypeForm(props: RoomTypeFormProps) {
  const isEdit = props.mode === "edit";
  const row = props.mode === "edit" ? props.row : null;
  const { onResult } = props;
  const onCancel = props.mode === "edit" ? props.onCancel : undefined;

  const [createState, createAction, createPending] = useActionState(
    createRoomType,
    INITIAL_STATE,
  );
  const [editState, editAction, editPending] = useActionState(
    updateRoomType,
    INITIAL_STATE,
  );

  const state = isEdit ? editState : createState;
  const action = isEdit ? editAction : createAction;
  const pending = isEdit ? editPending : createPending;

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!state.ok) {
      onResult(null);
      return;
    }

    onResult(
      isEdit
        ? "บันทึกการแก้ไขแล้ว"
        : state.restored
          ? "กู้คืนประเภทห้องที่เคยถูกลบแล้ว"
          : "เพิ่มประเภทห้องแล้ว",
    );

    if (isEdit) {
      onCancel?.();
      return;
    }

    formRef.current?.reset();
  }, [state, isEdit, onResult, onCancel]);

  const fieldId = useId();
  const errorMessage = state && !state.ok ? state.message : null;

  return (
    <form ref={formRef} action={action} className="panel p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight text-ink">
        {isEdit ? `แก้ไขประเภทห้อง ${row?.code ?? ""}` : "เพิ่มประเภทห้อง"}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        {isEdit
          ? "ปรับชื่อ โหมดการจอง และระยะเวลาขั้นต่ำของประเภทนี้"
          : "กำหนดรหัส ชื่อ โหมดการจอง และระยะเวลาขั้นต่ำของประเภทห้อง"}
      </p>

      {isEdit && row ? <input type="hidden" name="id" value={row.id} /> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-code`} className="field-label">
            รหัสประเภท
          </label>
          <input
            id={`${fieldId}-code`}
            name="code"
            defaultValue={row?.code ?? ""}
            maxLength={1}
            required
            autoComplete="off"
            placeholder="เช่น S"
            className="field text-center uppercase tabular-nums"
          />
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            ตัวอักษร 1 ตัว ใช้เป็นรหัสย่อของประเภท
          </p>
        </div>

        <div>
          <label htmlFor={`${fieldId}-name`} className="field-label">
            ชื่อประเภทห้อง
          </label>
          <input
            id={`${fieldId}-name`}
            name="typeName"
            defaultValue={row?.typeName ?? ""}
            maxLength={100}
            required
            autoComplete="off"
            placeholder="เช่น ห้องทั่วไป"
            className="field"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-mode`} className="field-label">
            โหมดการจอง
          </label>
          <FieldSelect
            id={`${fieldId}-mode`}
            name="bookingMode"
            defaultValue={row?.bookingMode ?? "CAPACITY"}
            required
          >
            <option value="CAPACITY">{BOOKING_MODE_LABEL.CAPACITY}</option>
            <option value="EXCLUSIVE">{BOOKING_MODE_LABEL.EXCLUSIVE}</option>
          </FieldSelect>
        </div>

        <div>
          <label htmlFor={`${fieldId}-min`} className="field-label">
            ระยะเวลาขั้นต่ำ (นาที)
          </label>
          <input
            id={`${fieldId}-min`}
            type="number"
            name="minDurationMinutes"
            defaultValue={row?.minDurationMinutes ?? 60}
            min={1}
            step={1}
            required
            inputMode="numeric"
            className="field tabular-nums"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
          {pending ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "เพิ่มประเภทห้อง"}
        </button>
        {props.mode === "edit" ? (
          <button type="button" onClick={props.onCancel} className="btn btn-outline">
            ยกเลิก
          </button>
        ) : null}
      </div>

      {errorMessage ? <Alert tone="danger" heading={errorMessage} className="mt-4" /> : null}
    </form>
  );
}
