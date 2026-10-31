import type { BookingMode } from "@/lib/admin/room-types";

import type { RoomSlotView } from "./day-availability";

/**
 * ตัวช่วยแสดงผลของช่องว่าง — ป้ายสถานะภาษาไทยสำหรับหน้าผู้ใช้
 * สถานะหลัก 3 แบบตาม AC: ว่าง / ไม่ว่าง (CAPACITY แสดงจำนวนที่ใช้) / ถูกบล็อก
 * และ "ผ่านไปแล้ว" สำหรับช่องที่เริ่มแล้วของวันนี้
 */

/**
 * ความยาวของบล็อกของห้อง (นาที) เป็นข้อความไทย — '1 ชั่วโมง', '2 ชั่วโมง'
 * หรือ 'X นาที' เมื่อไม่ลงตัวเป็นชั่วโมง (บล็อกยาวเท่าระยะเวลาขั้นต่ำของประเภทห้อง)
 */
export function slotLengthLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} ชั่วโมง` : `${minutes} นาที`;
}

/**
 * ข้อความความยาวบล็อกชุดเดียวของทั้งระบบ — ใช้ซ้ำทุกที่ที่อธิบายกติกาความยาวบล็อก
 * เพื่อไม่ให้คัดลอกข้อความแล้วคลาดเคลื่อนจากกัน (หน้าจองห้อง, เวลาทำการ, ผนังกติกา)
 */
export const BLOCK_LENGTH_COPY =
  "ห้องทั่วไป/ละหมาด จองขั้นต่ำครั้งละ 1 ชั่วโมง, ห้องประชุมใหญ่ จองขั้นต่ำครั้งละ 2 ชั่วโมง (ตามระยะเวลาขั้นต่ำของแต่ละประเภทห้อง)";

/**
 * คลาสป้ายสถานะช่องเวลาตามโทนสีระบบ (flat, ไม่มีเงา):
 * ว่าง = เขียว KU (สีเน้นของ "สถานะว่าง"), ไม่ว่าง = amber,
 * ถูกบล็อก/ผ่านไปแล้ว = โทนเงียบ ink-muted บนพื้น canvas
 */
export const SLOT_FREE_CLASS = "bg-ku-soft text-ku";
export const SLOT_FREE_SELECTABLE_CLASS =
  "bg-ku-soft text-ku cursor-pointer hover:bg-ku hover:text-white";
export const SLOT_OCCUPIED_CLASS = "bg-amber-soft text-amber-ink";
export const SLOT_OCCUPIED_SELECTABLE_CLASS =
  "bg-amber-soft text-amber-ink cursor-pointer";
export const SLOT_MUTED_CLASS = "bg-canvas text-ink-muted";

/**
 * ตัวเลือกของ slotChipClass — `clickable` คือ "กดได้จริงไหม" ไม่ใช่แค่ "กติกาอนุญาตไหม"
 * ตารางห้องใช้ค่านี้เพื่อบอกว่าวันนั้นอยู่นอกหน้าต่างการจอง (ดูอย่างเดียว) — ชิปยังต้องกดไม่ได้
 * แต่ยังคงสีสถานะตามจริง ไม่มี hover/cursor แบบปุ่ม
 */
export type SlotChipOptions = {
  /** true = เป็นปุ่มกดได้ (มี cursor-pointer/hover), false = ป้ายสถานะล้วน */
  clickable?: boolean;
};

export function slotChipClass(
  slot: Pick<RoomSlotView, "status" | "past" | "selectable">,
  options: SlotChipOptions = {},
): string {
  // ไม่ส่ง clickable = ใช้ selectable ของช่องเป็นค่าเริ่มต้น (พฤติกรรมเดิมของ slot picker)
  const clickable = options.clickable ?? slot.selectable;

  if (slot.past || slot.status === "blocked") {
    return SLOT_MUTED_CLASS;
  }

  if (slot.status === "occupied") {
    return clickable ? SLOT_OCCUPIED_SELECTABLE_CLASS : SLOT_OCCUPIED_CLASS;
  }

  return clickable ? SLOT_FREE_SELECTABLE_CLASS : SLOT_FREE_CLASS;
}

/** ป้ายสถานะของช่องว่างสำหรับแสดงผล */
export function slotStatusLabel(
  slot: RoomSlotView,
  bookingMode: BookingMode,
  maxCapacity: number | null,
): string {
  if (slot.past) {
    return "ผ่านไปแล้ว";
  }

  if (slot.status === "blocked") {
    return "ถูกบล็อก";
  }

  if (slot.status === "occupied") {
    return bookingMode === "CAPACITY"
      ? `ไม่ว่าง ${slot.usedCount}/${maxCapacity ?? 0}`
      : "ไม่ว่าง";
  }

  return "ว่าง";
}

/** ชื่อที่ screen reader อ่าน — เวลา + สถานะ และเหตุผลเมื่อเลือกไม่ได้ */
export function slotAriaLabel(
  slot: RoomSlotView,
  bookingMode: BookingMode,
  maxCapacity: number | null,
): string {
  const label = `${slot.start}–${slot.end} น. ${slotStatusLabel(slot, bookingMode, maxCapacity)}`;

  if (slot.selectable) {
    return label;
  }

  if (slot.past) {
    return `${label} (เวลาผ่านไปแล้ว ไม่สามารถเลือกได้)`;
  }

  if (slot.status === "blocked") {
    return `${label} (ห้องถูกบล็อกช่วงเวลานี้)`;
  }

  if (bookingMode === "CAPACITY" && slot.usedCount >= (maxCapacity ?? 0)) {
    return `${label} (เต็มความจุแล้ว)`;
  }

  return `${label} (มีผู้ใช้จองแล้ว)`;
}
