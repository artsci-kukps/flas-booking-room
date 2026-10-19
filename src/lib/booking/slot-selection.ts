import type { RoomDayAvailability, RoomSlotView } from "./day-availability";

import type { BookingBlock } from "./booking-plan";

/**
 * การเลือกช่องว่างของผู้ใช้ — ตรรกะล้วน ไม่ขึ้นกับ React (ทดสอบใน slot-selection.test.ts)
 * เลือกได้หลายบล็อก (จองหลายชั่วโมงได้) แต่ต้องเป็น "ห้องเดียวกันเท่านั้น" ต่อการจองหนึ่งครั้ง
 * เพราะการยืนยันกับเจ้าหน้าที่ทำทีละห้อง (TOR ข้อ 6.1)
 */

/** บล็อกที่ผู้ใช้กำลังจะยืนยันการจอง — เลือกได้หลายบล็อกของห้องเดียว เรียงตามเวลา */
export type SlotSelection = {
  roomId: string;
  roomName: string;
  blocks: BookingBlock[];
};

/**
 * กดช่องว่างหนึ่ง — คืนค่าการเลือกชุดใหม่
 * - ช่องที่ `selectable` = false ไม่เปลี่ยนแปลงอะไร (Disabled ที่ UI เป็นชั้นแรก)
 * - กดช่องของห้องอื่น = เริ่มเลือกใหม่เฉพาะห้องนั้น (ไม่ให้ข้ามห้องในหนึ่งการจอง)
 * - กดช่องเดิมซ้ำ = ยกเลิกบล็อกนั้น; ถ้าไม่เหลือบล็อก = null
 * - เพิ่มช่องอื่นของห้องเดียวกันเข้าไป แล้วเรียงบล็อกตามเวลาเสมอ
 */
export function toggleSlotSelection(
  current: SlotSelection | null,
  room: { id: string; name: string },
  slot: Pick<RoomSlotView, "start" | "end" | "selectable">,
): SlotSelection | null {
  if (!slot.selectable) {
    return current;
  }

  const block: BookingBlock = { start: slot.start, end: slot.end };

  if (!current || current.roomId !== room.id) {
    return { roomId: room.id, roomName: room.name, blocks: [block] };
  }

  const existing = current.blocks.find((candidate) => candidate.start === slot.start);
  const blocks = existing
    ? current.blocks.filter((candidate) => candidate.start !== slot.start)
    : [...current.blocks, block].sort((a, b) => a.start.localeCompare(b.start));

  if (blocks.length === 0) {
    return null;
  }

  return { roomId: current.roomId, roomName: current.roomName, blocks };
}

/**
 * การเลือกเริ่มต้นเมื่อเปิด popup จากการคลิกช่องว่างในตารางห้อง (ticket #20)
 * - ชี้เวลาที่มีจริงในวันนั้นและ `selectable` = เลือกบล็อกนั้นทันที (จองผ่านตารางน้อยกว่า 1 คลิก)
 * - ชี้ช่องที่เลือกไม่ได้หรือเวลาที่ไม่มี → null — กัน popup เปิดมาพร้อมบล็อกที่ยืนยันไม่ได้
 */
export function preselectSlot(
  room: Pick<RoomDayAvailability, "id" | "name" | "slots">,
  start: string | null | undefined,
): SlotSelection | null {
  if (!start) {
    return null;
  }

  const slot = room.slots.find((candidate) => candidate.start === start);

  if (!slot || !slot.selectable) {
    return null;
  }

  return {
    roomId: room.id,
    roomName: room.name,
    blocks: [{ start: slot.start, end: slot.end }],
  };
}
