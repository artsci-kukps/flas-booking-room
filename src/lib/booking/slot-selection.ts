import type { RoomSlotView } from "./day-availability";

/**
 * การเลือกช่องว่างของผู้ใช้ — ตรรกะล้วน ไม่ขึ้นกับ React (ทดสอบใน slot-selection.test.ts)
 * จอง 1 บล็อก = เก็บการเลือกได้ที่ละชุดเดียว; กดช่องเดิมซ้ำเพื่อยกเลิก
 */

/** ช่องว่างที่ผู้ใช้กำลังจะยืนยันการจอง */
export type SlotSelection = {
  roomId: string;
  roomName: string;
  /** 'HH:MM' */
  start: string;
  /** 'HH:MM' */
  end: string;
};

/**
 * กดช่องว่างหนึ่ง — คืนค่าการเลือกชุดใหม่
 * - ช่องที่ `selectable` = false ไม่เปลี่ยนแปลงอะไร (เป็นแนวป้องกันชั้นที่สอง ชั้นแรกคือ disabled)
 * - กดช่องเดิมซ้ำ = ยกเลิก (null), กดช่องอื่น = เลือกใหม่แทนที่ (จองทีละบล็อก)
 */
export function toggleSlotSelection(
  current: SlotSelection | null,
  room: { id: string; name: string },
  slot: Pick<RoomSlotView, "start" | "end" | "selectable">,
): SlotSelection | null {
  if (!slot.selectable) {
    return current;
  }

  if (current?.roomId === room.id && current.start === slot.start) {
    return null;
  }

  return {
    roomId: room.id,
    roomName: room.name,
    start: slot.start,
    end: slot.end,
  };
}
