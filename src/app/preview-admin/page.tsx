import { bookRoomFromTable } from "@/app/(protected)/admin/booking/actions";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";
import { todayInBangkok } from "@/lib/admin/service-periods";
import type { DayAvailability } from "@/lib/booking/day-availability";

import BookingManagementView from "@/app/(protected)/admin/booking-management/booking-management-view";
import type { CodeSearchState } from "@/app/(protected)/admin/booking-management/booking-code-search";

export const dynamic = "force-dynamic";

function booking(
  overrides: Partial<AdminBookingRow> & Pick<AdminBookingRow, "id" | "bookingCode" | "status">,
): AdminBookingRow {
  return {
    bookerName: "สมชาย ใจดี",
    bookerEmail: "somchai@ku.th",
    roomName: "S-201",
    roomTypeCode: "S",
    startTime: new Date("2026-10-27T02:30:00Z"),
    endTime: new Date("2026-10-27T03:30:00Z"),
    ...overrides,
  };
}

const BOOKINGS: AdminBookingRow[] = [
  booking({
    id: "1",
    bookingCode: "482913",
    bookerName: "สมชาย ใจดี",
    bookerEmail: "somchai@ku.th",
    roomName: "S-201",
    roomTypeCode: "S",
    startTime: new Date("2026-10-27T02:00:00Z"),
    endTime: new Date("2026-10-27T03:00:00Z"),
    status: "PENDING",
  }),
  booking({
    id: "2",
    bookingCode: "731508",
    bookerName: "ณภัทร ศรีสุข",
    bookerEmail: "napat.s@ku.th",
    roomName: "G-301",
    roomTypeCode: "G",
    startTime: new Date("2026-10-27T03:00:00Z"),
    endTime: new Date("2026-10-27T05:00:00Z"),
    status: "ACTIVE",
  }),
  booking({
    id: "3",
    bookingCode: "205764",
    bookerName: "ปวีณา วงศ์ทอง",
    bookerEmail: "paweena.w@ku.th",
    roomName: "S-202",
    roomTypeCode: "S",
    startTime: new Date("2026-10-27T01:30:00Z"),
    endTime: new Date("2026-10-27T02:30:00Z"),
    status: "COMPLETED",
  }),
  booking({
    id: "4",
    bookingCode: "960147",
    bookerName: "อารีย์ จันทร์เพ็ญ",
    bookerEmail: "aree.j@ku.th",
    roomName: "P-101",
    roomTypeCode: "P",
    startTime: new Date("2026-10-27T06:00:00Z"),
    endTime: new Date("2026-10-27T07:00:00Z"),
    status: "LATE_RETURN",
  }),
  booking({
    id: "5",
    bookingCode: "318452",
    bookerName: "ธนกฤต บุญมี",
    bookerEmail: "thanakrit.b@ku.th",
    roomName: "G-302",
    roomTypeCode: "G",
    startTime: new Date("2026-10-27T07:00:00Z"),
    endTime: new Date("2026-10-27T09:00:00Z"),
    status: "CANCELLED",
  }),
];

const AVAILABILITY: DayAvailability = {
  date: "2026-10-27",
  open: true,
  kind: "NORMAL",
  openTime: "08:30",
  closeTime: "12:30",
  rooms: [
    {
      id: "room-s201",
      name: "S-201",
      roomTypeCode: "S",
      roomTypeName: "ห้องทำงานเดี่ยว",
      bookingMode: "CAPACITY",
      maxCapacity: 2,
      minDurationMinutes: 60,
      slots: [
        { start: "08:30", end: "09:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "09:30", end: "10:30", status: "occupied", usedCount: 1, past: false, selectable: true },
        { start: "10:30", end: "11:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "11:30", end: "12:30", status: "blocked", usedCount: 0, past: false, selectable: false },
      ],
    },
    {
      id: "room-s202",
      name: "S-202",
      roomTypeCode: "S",
      roomTypeName: "ห้องทำงานเดี่ยว",
      bookingMode: "CAPACITY",
      maxCapacity: 2,
      minDurationMinutes: 60,
      slots: [
        { start: "08:30", end: "09:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "09:30", end: "10:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "10:30", end: "11:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "11:30", end: "12:30", status: "free", usedCount: 0, past: false, selectable: true },
      ],
    },
    {
      id: "room-g301",
      name: "G-301",
      roomTypeCode: "G",
      roomTypeName: "ห้องประชุม",
      bookingMode: "EXCLUSIVE",
      maxCapacity: 10,
      minDurationMinutes: 120,
      slots: [
        { start: "08:30", end: "10:30", status: "occupied", usedCount: 1, past: false, selectable: false },
        { start: "10:30", end: "12:30", status: "free", usedCount: 0, past: false, selectable: true },
      ],
    },
    {
      id: "room-p101",
      name: "P-101",
      roomTypeCode: "P",
      roomTypeName: "ห้องละหมาด",
      bookingMode: "EXCLUSIVE",
      maxCapacity: 4,
      minDurationMinutes: 60,
      slots: [
        { start: "08:30", end: "09:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "09:30", end: "10:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "10:30", end: "11:30", status: "free", usedCount: 0, past: false, selectable: true },
        { start: "11:30", end: "12:30", status: "free", usedCount: 0, past: false, selectable: true },
      ],
    },
  ],
};

export default async function PreviewAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const today = todayInBangkok();
  const state = (await searchParams).state;

  let searchState: CodeSearchState = { kind: "idle" };

  if (state === "found") {
    searchState = { kind: "found", booking: BOOKINGS[0]! };
  } else if (state === "invalid") {
    searchState = { kind: "invalid" };
  } else if (state === "notfound") {
    searchState = { kind: "not-found", code: "999999" };
  }

  return (
    <div className="min-h-dvh bg-canvas lg:pl-[17.5rem]">
      <BookingManagementView
        date={today}
        today={today}
        bookings={state === "empty" ? [] : BOOKINGS}
        availability={AVAILABILITY}
        searchState={searchState}
        bookRoomAction={bookRoomFromTable}
      />
    </div>
  );
}
