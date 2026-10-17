import { roomTypeCodeBadge } from "@/lib/admin/room-display";

type RoomTypeCodeBadgeProps = {
  code: string;
  className?: string;
};

/**
 * ป้ายรหัสประเภทห้อง — สี่เหลี่ยมมุมโค้ง 9px ขนาด 28×28 ตาม DESIGN.md
 * สีจำแนกตามรหัส (S = เขียวแบรนด์, G = น้ำเงิน, P = ม่วง) ผ่าน roomTypeCodeBadge()
 */
export default function RoomTypeCodeBadge({ code, className }: RoomTypeCodeBadgeProps) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-sm font-semibold tabular-nums ${roomTypeCodeBadge(code)}${className ? ` ${className}` : ""}`}
    >
      {code}
    </span>
  );
}
