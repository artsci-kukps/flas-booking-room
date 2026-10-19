import { getDayAvailability } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

import SlotPicker from "./slot-picker";

/**
 * แผงแสดงช่องว่างของห้องในวันที่เลือก — อ่านข้อมูลจาก getDayAvailability แล้วแสดงผล
 * การเลือกช่องว่างและการยืนยันจองเป็นของ SlotPicker (client component, ticket #8)
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

      <SlotPicker date={data.date} rooms={data.rooms} />
    </section>
  );
}
