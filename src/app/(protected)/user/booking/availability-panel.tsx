import { getDayAvailability } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";
import { slotAriaLabel, slotChipClass, slotStatusLabel } from "@/lib/booking/slot-display";
import RoomTypeCodeBadge from "@/components/room-type-code-badge";

/**
 * แผงแสดงช่องว่างของห้องในวันที่เลือก — อ่านข้อมูลจาก getDayAvailability แล้วแสดงผล
 * ปุ่มช่องว่างเป็น disabled สำหรับช่องที่ไม่สามารถเลือกได้ (ยังไม่อนุญาตให้กดยืนยันการจอง;
 * เนื้อหาการเลือกหลายบล็อกและการส่งฟอร์มเป็นของ ticket #8)
 */
export default async function AvailabilityPanel({ date }: { date: string }) {
  const data = await getDayAvailability(date);

  if (!data.open) {
    const dateTh = formatThaiDate(data.date);
    let message = "ปิดทำการในวันที่เลือก";

    if (data.reason === "weekend") {
      const dow = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
        timeZone: "Asia/Bangkok",
        weekday: "long",
      }).format(new Date(`${data.date}T12:00:00Z`));

      message = `ปิดทำการในวันที่ ${dateTh} (${dow})`;
    } else if (data.reason === "holiday") {
      message = data.holidayName ? `ปิดทำการ — ${data.holidayName}` : "ปิดทำการ (วันหยุดนักขัตฤกษ์)";
    } else if (data.reason === "no-service-period") {
      message = "ยังไม่มีช่วงเวลาให้บริการสำหรับวันที่เลือก";
    }

    return (
      <section aria-labelledby="availability-heading" className="panel mt-6 p-6">
        <h2 id="availability-heading" className="text-base font-semibold tracking-tight text-ink">
          ช่องว่างของห้อง — {dateTh}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{message}</p>
      </section>
    );
  }

  const dateTh = formatThaiDate(data.date);

  return (
    <section aria-labelledby="availability-heading" className="mt-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="availability-heading" className="text-base font-semibold tracking-tight text-ink">
            ช่องว่างของห้อง — {dateTh}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            เวลาเปิด–ปิด: <span className="tabular-nums">{data.openTime}–{data.closeTime}</span>
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {data.rooms.map((room) => (
          <div key={room.id} className="panel">
            <div className="flex flex-wrap items-start gap-3 p-5">
              <RoomTypeCodeBadge code={room.roomTypeCode} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.0625rem] font-semibold tracking-tight text-ink">
                  {room.name}
                </h3>
                <p className="mt-0.5 text-sm text-ink-muted">{room.roomTypeName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {room.slots.map((slot) => {
                const aria = slotAriaLabel(slot, room.bookingMode, room.maxCapacity);
                const status = slotStatusLabel(slot, room.bookingMode, room.maxCapacity);

                return (
                  <button
                    key={`${room.id}-${slot.start}`}
                    type="button"
                    className={`flex flex-col items-center justify-center rounded-[12px] border border-border px-3 py-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${slotChipClass(slot)}`}
                    aria-label={aria}
                    disabled={!slot.selectable}
                  >
                    <span className="text-sm font-semibold tabular-nums text-ink">
                      {slot.start}–{slot.end}
                    </span>
                    <span className="mt-1 text-xs">{status}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
