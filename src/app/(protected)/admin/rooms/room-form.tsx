"use client";

import { useActionState, useEffect, useId, useState } from "react";

import Alert from "@/components/alert";
import FieldSelect from "@/components/field-select";
import { BOOKING_MODE_LABEL } from "@/lib/admin/room-display";
import type { AdminRoomRow } from "@/lib/admin/rooms";
import type { RoomTypeRow } from "@/lib/admin/room-types";

import { createRoom, updateRoom, type RoomActionState } from "./actions";

const INITIAL_STATE: RoomActionState = null;

type RoomFormProps =
  | {
      mode: "create";
      roomTypes: RoomTypeRow[];
      /** แจ้งผลลัพธ์กลับไปให้หน้าจอ: ข้อความสำเร็จ หรือ null เมื่อล้มเหลว (ล้างข้อความเดิม) */
      onResult: (message: string | null) => void;
    }
  | {
      mode: "edit";
      row: AdminRoomRow;
      roomTypes: RoomTypeRow[];
      onResult: (message: string | null) => void;
      onCancel: () => void;
    };

/**
 * ฟอร์มเพิ่ม/แก้ไขห้อง — ใช้ useActionState สองตัว (เพิ่ม/แก้ไข) แล้วเลือกตามโหมด
 * ความจุเป็น "จำเป็น" เฉพาะเมื่อประเภทที่เลือกเป็น CAPACITY (ไม่บังคับเมื่อ EXCLUSIVE)
 * เมื่อยังไม่มีประเภทห้องที่ใช้งานอยู่ จะขึ้นคำเตือนและปิดปุ่มบันทึก
 */
export default function RoomForm(props: RoomFormProps) {
  const isEdit = props.mode === "edit";
  const row = props.mode === "edit" ? props.row : null;
  const roomTypes = props.roomTypes;
  const { onResult } = props;
  const onCancel = props.mode === "edit" ? props.onCancel : undefined;

  const [createState, createAction, createPending] = useActionState(createRoom, INITIAL_STATE);
  const [editState, editAction, editPending] = useActionState(updateRoom, INITIAL_STATE);

  const state = isEdit ? editState : createState;
  const action = isEdit ? editAction : createAction;
  const pending = isEdit ? editPending : createPending;

  const [selectedTypeId, setSelectedTypeId] = useState(row?.roomTypeId ?? "");
  const selectedType = roomTypes.find((type) => type.id === selectedTypeId);
  const requiresCapacity = selectedType?.bookingMode === "CAPACITY";
  const noRoomTypes = roomTypes.length === 0;

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!state.ok) {
      onResult(null);
      return;
    }

    onResult(
      isEdit ? "บันทึกการแก้ไขแล้ว" : state.restored ? "กู้คืนห้องที่เคยถูกลบแล้ว" : "เพิ่มห้องแล้ว",
    );

    if (isEdit) {
      onCancel?.();
    }
  }, [state, isEdit, onResult, onCancel]);

  const fieldId = useId();
  const errorMessage = state && !state.ok ? state.message : null;

  return (
    <form action={action} className="panel p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight text-ink">
        {isEdit ? `แก้ไขห้อง ${row?.name ?? ""}` : "เพิ่มห้อง"}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        {isEdit
          ? "ปรับชื่อ ประเภท ความจุ และสิ่งอำนวยความสะดวกของห้องนี้"
          : "กำหนดชื่อ ประเภท และรายละเอียดของห้องใหม่"}
      </p>

      {isEdit && row ? <input type="hidden" name="id" value={row.id} /> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-name`} className="field-label">
            ชื่อห้อง
          </label>
          <input
            id={`${fieldId}-name`}
            name="name"
            defaultValue={row?.name ?? ""}
            maxLength={100}
            required
            autoComplete="off"
            placeholder="เช่น S-101"
            className="field"
          />
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            ตั้งชื่อให้สื่อถึงที่ตั้งหรือการใช้งาน เช่น S-101, ห้องประชุม 1
          </p>
        </div>

        <div>
          <label htmlFor={`${fieldId}-type`} className="field-label">
            ประเภทห้อง
          </label>
          <FieldSelect
            id={`${fieldId}-type`}
            name="roomTypeId"
            value={selectedTypeId}
            onChange={(event) => setSelectedTypeId(event.target.value)}
            required
          >
            <option value="" disabled>
              — เลือกประเภทห้อง —
            </option>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.code} · {type.typeName}
              </option>
            ))}
          </FieldSelect>
          {selectedType ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              โหมดการจอง: {BOOKING_MODE_LABEL[selectedType.bookingMode]}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              เลือกประเภทเพื่อกำหนดกติกาการจองของห้องนี้
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${fieldId}-capacity`} className="field-label">
            ความจุ (คน)
          </label>
          <input
            id={`${fieldId}-capacity`}
            type="number"
            name="maxCapacity"
            defaultValue={row?.maxCapacity ?? ""}
            min={1}
            step={1}
            required={requiresCapacity}
            inputMode="numeric"
            placeholder="เช่น 4"
            className="field tabular-nums"
          />
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {requiresCapacity
              ? "ประเภทที่เลือกจองทับได้ตามความจุ จึงต้องระบุความจุมากกว่า 0"
              : "ไม่บังคับสำหรับประเภทที่ห้ามจองทับ (เว้นว่างได้)"}
          </p>
        </div>

        <div>
          <label htmlFor={`${fieldId}-facilities`} className="field-label">
            สิ่งอำนวยความสะดวก
          </label>
          <textarea
            id={`${fieldId}-facilities`}
            name="facilities"
            defaultValue={row?.facilities ?? ""}
            rows={3}
            maxLength={500}
            placeholder="เช่น โปรเจกเตอร์ โต๊ะ 10 ที่นั่ง"
            className="field-area"
          />
        </div>
      </div>

      {noRoomTypes ? (
        <Alert
          tone="warning"
          heading="ยังไม่มีประเภทห้องที่ใช้งานอยู่"
          body="กรุณาเพิ่มประเภทห้องก่อน จึงจะเพิ่มหรือแก้ไขห้องได้"
          className="mt-4"
        />
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending || noRoomTypes}
          aria-busy={pending}
          className="btn btn-primary"
        >
          {pending ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "เพิ่มห้อง"}
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
