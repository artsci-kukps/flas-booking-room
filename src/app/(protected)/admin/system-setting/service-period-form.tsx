"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import Alert from "@/components/alert";
import FieldSelect from "@/components/field-select";
import { SERVICE_PERIOD_KIND_LABEL } from "@/lib/admin/service-period-display";
import type { ServicePeriodRow } from "@/lib/admin/service-periods";

import {
  createServicePeriod,
  updateServicePeriod,
  type ServicePeriodActionState,
} from "./actions";

const INITIAL_STATE: ServicePeriodActionState = null;

type ServicePeriodFormProps =
  | {
      mode: "create";
      /** แจ้งผลลัพธ์กลับไปให้หน้าจอ: ข้อความสำเร็จ หรือ null เมื่อล้มเหลว (ล้างข้อความเดิม) */
      onResult: (message: string | null) => void;
    }
  | {
      mode: "edit";
      row: ServicePeriodRow;
      onResult: (message: string | null) => void;
      onCancel: () => void;
    };

/**
 * ฟอร์มเพิ่ม/แก้ไขช่วงเวลาให้บริการ — ใช้ useActionState สองตัว (เพิ่ม/แก้ไข) แล้วเลือกตามโหมด
 * สำเร็จสร้าง → ล้างฟอร์มและแจ้งเตือน; สำเร็จแก้ไข → คืนการควบคุมให้หน้าจอปิดฟอร์ม
 */
export default function ServicePeriodForm(props: ServicePeriodFormProps) {
  const isEdit = props.mode === "edit";
  const row = props.mode === "edit" ? props.row : null;
  const { onResult } = props;
  const onCancel = props.mode === "edit" ? props.onCancel : undefined;

  const [createState, createAction, createPending] = useActionState(
    createServicePeriod,
    INITIAL_STATE,
  );
  const [editState, editAction, editPending] = useActionState(
    updateServicePeriod,
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

    onResult(isEdit ? "บันทึกการแก้ไขแล้ว" : "เพิ่มช่วงเวลาให้บริการแล้ว");

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
        {isEdit ? "แก้ไขช่วงเวลาให้บริการ" : "เพิ่มช่วงเวลาให้บริการ"}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        กำหนดเวลาเปิด–ปิดและวันที่มีผล ช่วงสอบ (EXAM) ซ้อนทับช่วงปกติ (NORMAL) ได้
        แต่ช่วงชนิดเดียวกันห้ามทับซ้อนกัน
      </p>

      {isEdit && row ? <input type="hidden" name="id" value={row.id} /> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-name`} className="field-label">
            ชื่อช่วงเวลา
          </label>
          <input
            id={`${fieldId}-name`}
            name="name"
            defaultValue={row?.name ?? ""}
            maxLength={100}
            required
            autoComplete="off"
            placeholder="เช่น ช่วงสอบปลายภาค"
            className="field"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-kind`} className="field-label">
            ประเภท
          </label>
          <FieldSelect
            id={`${fieldId}-kind`}
            name="kind"
            defaultValue={row?.kind ?? "NORMAL"}
            required
          >
            <option value="NORMAL">{SERVICE_PERIOD_KIND_LABEL.NORMAL}</option>
            <option value="EXAM">{SERVICE_PERIOD_KIND_LABEL.EXAM}</option>
          </FieldSelect>
        </div>

        <div>
          <label htmlFor={`${fieldId}-open`} className="field-label">
            เวลาเปิด
          </label>
          <input
            id={`${fieldId}-open`}
            type="time"
            name="openTime"
            defaultValue={row?.openTime?.slice(0, 5) ?? "08:30"}
            required
            className="field tabular-nums"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-close`} className="field-label">
            เวลาปิด
          </label>
          <input
            id={`${fieldId}-close`}
            type="time"
            name="closeTime"
            defaultValue={row?.closeTime?.slice(0, 5) ?? "16:30"}
            required
            className="field tabular-nums"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-from`} className="field-label">
            มีผลตั้งแต่วันที่
          </label>
          <input
            id={`${fieldId}-from`}
            type="date"
            name="effectiveFrom"
            defaultValue={row?.effectiveFrom ?? ""}
            required
            className="field tabular-nums"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-to`} className="field-label">
            มีผลถึงวันที่
          </label>
          <input
            id={`${fieldId}-to`}
            type="date"
            name="effectiveTo"
            defaultValue={row?.effectiveTo ?? ""}
            className="field tabular-nums"
          />
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            เว้นว่าง = มีผลต่อเนื่องไม่จำกัดวันสิ้นสุด
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
          {pending ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "เพิ่มช่วงเวลา"}
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
