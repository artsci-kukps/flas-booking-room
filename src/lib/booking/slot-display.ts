import type { BookingMode } from "@/lib/admin/room-types";

import type { RoomSlotView } from "./day-availability";

/**
 * ตัวช่วยแสดงผลของช่องว่าง — ป้ายสถานะภาษาไทยสำหรับหน้าผู้ใช้
 * สถานะหลัก 3 แบบตาม AC: ว่าง / ไม่ว่าง (CAPACITY แสดงจำนวนที่ใช้) / ถูกบล็อก
 * และ "ผ่านไปแล้ว" สำหรับช่องที่เริ่มแล้วของวันนี้
 */

/**
 * คลาสป้ายสถานะช่องเวลาตามโทนสีระบบ (flat, ไม่มีเงา):
 * ว่าง = เขียว KU (สีเน้นของ "สถานะว่าง"), ไม่ว่าง = amber,
 * ถูกบล็อก/ผ่านไปแล้ว = โทนเงียบ ink-muted บนพื้น canvas
 */
export function slotChipClass(
  slot: Pick<RoomSlotView, "status" | "past" | "selectable">,
): string {
  if (slot.past || slot.status === "blocked") {
    return "bg-canvas text-ink-muted";
  }

  if (slot.status === "occupied") {
    // เลือกได้เฉพาะห้อง CAPACITY ที่ยังไม่เต็ม — ให้ feedback เบา ๆ ด้วย cursor เท่านั้น
    return slot.selectable
      ? "bg-amber-soft text-amber-ink cursor-pointer"
      : "bg-amber-soft text-amber-ink";
  }

  // ว่างและเลือกได้: hover เต็มสี KU เป็นรางวัลของการเจอช่องว่าง
  return slot.selectable
    ? "bg-ku-soft text-ku cursor-pointer hover:bg-ku hover:text-white"
    : "bg-ku-soft text-ku";
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
