# คิวแจ้งเตือนและอีเมลการจอง (`notification_outbox`)

เอกสารนี้อธิบายค่าที่ตัดสินในตั๋ว **#14** สำหรับภาคผนวก B ข้อ 2 (รูปแบบ/ภาษา/หัวข้ออีเมล และนโยบาย retry)
และข้อ 3 (ตารางเวลา `pg_cron`) ของ `TOR.md`
รวมถึงอีเมลแจ้งเตือนการยกเลิกการจองที่เพิ่มในตั๋ว **#21** (`type = BOOKING_CANCELLED`)

## ภาพรวมการทำงาน

```
จองสำเร็จ (createReservation)
  └─ เข้าคิว: INSERT notification_outbox (type = BOOKING_CODE, status = PENDING, next_attempt_at = now())
ยกเลิกการจอง (ผู้ใช้ยกเลิกเอง / แอดมินยกเลิก / แอดมิน override สถานะเป็น CANCELLED)
  └─ เข้าคิว: INSERT notification_outbox (type = BOOKING_CANCELLED, status = PENDING, next_attempt_at = now())
        (ทั้งสองประเภทอยู่ในคิวเดียวกัน ใช้นโยบาย retry เดียวกัน)
        └─ pg_cron (ทุก 1 นาที) → pg_net ยิง POST /api/cron/outbox
              └─ worker (processOutboxBatch): หยิบ PENDING ที่ next_attempt_at <= now()
                    ├─ สำเร็จ → SENT + sent_at
                    ├─ ล้มเหลว → attempts++ แล้วตั้ง next_attempt_at ตามนโยบาย retry
                    └─ ครบขีดจำกัด → FAILED + last_error
```

- `pg_cron` เป็นตัว **ตั้งเวลา** เท่านั้น เพราะส่ง HTTP (Resend) เองไม่ได้ — จึงใช้ `pg_net`
  ยิงเข้า worker ในแอป (`src/app/api/cron/outbox/route.ts`) แล้วให้ worker เป็นคนส่งและอัปเดตสถานะ
- การเข้าคิวเป็นการทำงาน **แบบเสริม** ไม่ทำให้การจองล้มเหลว: หน้ายืนยันบนจอแสดงรหัสเสมอ (ดู #8)
  แม้อีเมลจะส่งไม่ได้
- การเข้าคิวอีเมลแจ้งเตือนการยกเลิกก็เป็นงานเสริมแบบ non-blocking เช่นกัน — คิวล้มเหลวก็ไม่ทำให้
  การยกเลิกล้มเหลว (ดู "การเข้าคิวอีเมลแจ้งเตือนการยกเลิก")

## รูปแบบอีเมล (ภาคผนวก B.2)

กติการ่วมของอีเมลทุกประเภทในคิว:

| หัวข้อ | ค่าที่ตัดสิน |
| --- | --- |
| ภาษา | ไทยล้วน (ทั้งหัวเรื่องและเนื้อหา) |
| ข้อความล้วน | มี `text` คู่กับ `html` เสมอ (ไคลเอนต์ที่ไม่เรนเดอร์ HTML) |
| ผู้ส่ง | จาก `RESEND_FROM` (เช่น `Creative Space <booking@ku.th>`) |
| เขตเวลา | แสดงผลเป็น Asia/Bangkok เสมอ ผ่าน `src/lib/format.ts` — ไม่พึ่ง timezone ของเซิร์ฟเวอร์ |

### `BOOKING_CODE` — อีเมลรหัสการจอง

| หัวข้อ | ค่าที่ตัดสิน |
| --- | --- |
| หัวเรื่อง | `รหัสการจอง Creative Space: <รหัส 6 หลัก>` |
| โครงเนื้อหา | หัวข้อ "จองห้องสำเร็จ" → รหัสตัวใหญ่ในกรอบสีเขียว KU (#e9f4ee) → ชื่อห้อง → วันเวลาไทย (Asia/Bangkok) รูปแบบ `19 ต.ค. 2569 · 09:30–10:30 น.` → คำแนะนำให้แสดงรหัสกับเจ้าหน้าที่ ณ จุดรับกุญแจ → หมายเหตุว่ารหัสอยู่ในหน้ายืนยันบนจอเสมอ |
| เทมเพลต | `src/services/emails/booking-code.ts` (ใช้เชลล์กลาง `emails/layout.ts` — flat design เดียวกับหน้าเว็บ, ไม่มีปุ่ม CTA, ไม่มีเงา) |

### `BOOKING_CANCELLED` — อีเมลแจ้งเตือนการยกเลิกการจอง (#21)

| หัวข้อ | ค่าที่ตัดสิน |
| --- | --- |
| หัวเรื่อง | `ยกเลิกการจอง Creative Space: <รหัส 6 หลัก>` |
| โครงเนื้อหา | หัวข้อ "ยกเลิกการจองแล้ว" → ข้อความว่าการจองถูกยกเลิกแล้ว ช่วงเวลานี้กลับมาจองได้อีกครั้ง และให้ติดต่อเจ้าหน้าที่ถ้าไม่ใช่การดำเนินการของผู้รับ → รหัสการจองตัวใหญ่ในกรอบสีเขียว KU (#e9f4ee) → ชื่อห้อง → วันเวลาไทย (Asia/Bangkok) รูปแบบ `19 ต.ค. 2569 · 09:30–10:30 น.` → หมายเหตุว่าช่องเวลานี้กลับมาจองได้แล้ว |
| เหตุผลการยกเลิก | **ไม่บังคับ** — ถ้ามีเหตุผลจะมีกรอบ "เหตุผลการยกเลิก" ต่อท้ายเนื้อหา ถ้า `reason` เป็น `null` (ผู้ใช้ยกเลิกเอง) จะไม่มีกรอบนี้และไม่มีหัวข้อ "เหตุผลการยกเลิก" ในข้อความล้วน |
| เทมเพลต | `src/services/emails/booking-cancellation.ts` (ใช้เชลล์กลาง `emails/layout.ts` เหมือนกัน — flat design, ไม่มีปุ่ม CTA, ไม่มีเงา) |

## โครงสร้าง `payload` (jsonb)

ทุกประเภทใช้ฟิลด์อ้างอิงการจองชุดเดียวกัน: `bookingCode`, `roomName`, `bookingDate` (`'YYYY-MM-DD'`),
`startTime` / `endTime` (ISO 8601)

| `type` | ฟิลด์เพิ่มเติม |
| --- | --- |
| `BOOKING_CODE` | — |
| `BOOKING_CANCELLED` | `reason` — `string` หรือ `null` (ไม่บังคับ) |

- `reason` เป็น `null` เมื่อผู้ใช้ยกเลิกเอง (ผู้ใช้ไม่ต้องระบุเหตุผล) และเป็นข้อความเหตุผลเมื่อแอดมินระบุ
- ตอนเข้าคิว ค่า `reason` จะถูกตัดช่องว่างออก — ถ้าเหลือว่างจะถูกเก็บเป็น `null`
- ฟิลด์อ้างอิงการจองที่ขาด/ผิดรูปแบบ รวมถึง `reason` ที่ไม่ใช่ string/null → สร้างอีเมลไม่ได้
  ถือเป็นความผิดพลาดถาวร → `FAILED` ทันที ไม่เสียเวลา retry

## การเข้าคิวอีเมลแจ้งเตือนการยกเลิก (`BOOKING_CANCELLED`)

ทางเข้าร่วมคือ `enqueueBookingCancellationForReservation(reservationId, reason)` ใน
`src/lib/notifications/cancellation.ts` — ดึงรหัสการจอง/ชื่อห้อง/วันเวลา/อีเมลผู้จองจากฐานข้อมูล
แล้วเข้าคิวเป็น `type = BOOKING_CANCELLED` (`status = PENDING`, `next_attempt_at = now()`)

- **แบบเสริม (best-effort / non-blocking)**: กลืนข้อผิดพลาดทั้งหมด (log แล้วจบ) — การยกเลิกล้มเหลวไม่ได้
  เพราะคิวหรืออีเมลขัดข้อง เหมือนการเข้าคิวรหัสการจอง
- เข้าคิวหลังยกเลิกสำเร็จแล้วเท่านั้น — ถ้ายกเลิกไม่สำเร็จจะไม่มีอีเมล
- ผู้จองไม่มีอีเมล → ไม่เข้าคิว (ไม่ส่งอีเมล)

จุดที่เข้าคิว:

| กรณี | ฟังก์ชัน | `reason` ที่ส่ง |
| --- | --- | --- |
| ผู้ใช้ยกเลิกการจองของตัวเอง | `cancelMyReservation` ใน `src/lib/booking/my-bookings.ts` | `null` (ผู้ใช้ยกเลิกเองไม่ต้องระบุเหตุผล) |
| แอดมินยกเลิกการจอง | `cancelReservation` ใน `src/lib/admin/booking-admin.ts` | เหตุผลที่แอดมินระบุ (บังคับให้ระบุ) |
| แอดมินแก้สถานะการจองเป็น `CANCELLED` | `overrideReservationStatus` ใน `src/lib/admin/booking-admin.ts` | เหตุผลที่แอดมินระบุ (บังคับให้ระบุ) |

## นโยบาย retry (ภาคผนวก B.2)

- พยายามส่งสูงสุด **5 ครั้ง** ต่อหนึ่งรายการ (`MAX_OUTBOX_ATTEMPTS = 5` ใน `src/lib/notifications/outbox.ts`)
- ระยะห่างก่อนลองใหม่หลังล้มเหลวครั้งที่ 1–4: **1, 5, 15, 60 นาที** (`OUTBOX_RETRY_DELAYS_MS`)
  รวมเวลาถึงจุดยอมแพ้ประมาณ 81 นาที นับจากความพยายามครั้งแรก
- ล้มเหลวครั้งที่ 5 → `status = FAILED` และเก็บข้อความ error ไว้ที่ `last_error` (ตัดที่ 1000 ตัวอักษร) โดยไม่ตั้ง `next_attempt_at` ใหม่
- ระหว่างรอ retry รายการยังเป็น `PENDING` และถูกข้ามจนกว่า `next_attempt_at` จะถึง
- **payload ผิดรูปแบบ** (สร้างอีเมลไม่ได้) ถือเป็นความผิดพลาดถาวร → `FAILED` ทันที ไม่เสียเวลา retry
- **ประเภทอีเมลที่ไม่รู้จัก** ก็เป็นความผิดพลาดถาวรเช่นกัน → `FAILED` ทันที
- เลือกงานด้วย index `outbox_pending_idx (status, next_attempt_at)` และจำกัดรอบละ 20 รายการ (`OUTBOX_BATCH_SIZE`)

## ตารางเวลา `pg_cron` (ภาคผนวก B.3)

- job `notification-outbox-dispatch` ทำงาน **ทุก 1 นาที** (`* * * * *`) — รายละเอียด/เหตุผลและการตรวจสอบ
  อยู่ในแหล่งอ้างอิงกลางของทุก job: [`docs/pg-cron-schedules.md`](../pg-cron-schedules.md)
- เพราะเป็นงานยิงตามนาที ตารางเวลาจึงไม่ขึ้นกับ timezone; จุดที่ต้องเป็น Asia/Bangkok (การแสดงวัน/เวลา
  ของการจอง) จัดการในชั้นแอปแล้ว (ดูข้อ TOR เรื่องเขตเวลา)
- ประกาศไว้ใน `drizzle/0003_notification_outbox_cron.sql` (custom migration — `CREATE EXTENSION` /
  `cron.schedule` ประกาศใน `schema.ts` ไม่ได้ตาม A.12)

## การตั้งค่า

| ตัวแปร | ใช้ที่ | คำอธิบาย |
| --- | --- | --- |
| `RESEND_API_KEY` | แอป (worker) | API key ของ Resend |
| `RESEND_FROM` (สำรอง `EMAIL_FROM`) | แอป (worker) | ผู้ส่งอีเมล |
| `CRON_SECRET` | แอป (route) | ตรวจ `Authorization: Bearer` / `x-cron-secret` ก่อนทำงาน (fail closed ถ้าไม่ตั้ง) |
| `app.outbox_url` (GUC) | ฐานข้อมูล | URL ของ `/api/cron/outbox` ที่ `pg_net` จะยิง |
| `app.cron_secret` (GUC) | ฐานข้อมูล | ค่าเดียวกับ `CRON_SECRET` |

ตั้งค่า GUC ฝั่งฐานข้อมูลก่อนใช้งาน:

```sql
ALTER DATABASE <db> SET app.outbox_url  = 'https://<app>/api/cron/outbox';
ALTER DATABASE <db> SET app.cron_secret = '<CRON_SECRET>';
```

ถ้ายังไม่ตั้ง `app.outbox_url` งาน pg_cron จะไม่ยิงอะไรเลย (กันด้วย `WHERE`)

## ไฟล์ที่เกี่ยวข้อง

- `src/lib/notifications/outbox.ts` — นโยบาย retry, เข้าคิว, worker (`processOutboxBatch`)
- `src/lib/notifications/cancellation.ts` — ทางเข้าร่วมของการเข้าคิวอีเมลยกเลิก (best-effort / non-blocking)
- `src/services/emails/booking-code.ts` — เทมเพลตอีเมลรหัสการจอง
- `src/services/emails/booking-cancellation.ts` — เทมเพลตอีเมลแจ้งเตือนการยกเลิกการจอง
- `src/services/resend.service.ts` — ตัวส่งผ่าน Resend (ฉีด fetch ได้, ไม่ยิงเครือข่ายในเทสต์)
- `src/app/api/cron/outbox/route.ts` — worker endpoint สำหรับ pg_cron (ป้องกันด้วย `CRON_SECRET`)
- `src/lib/booking/reservations.ts` — เข้าคิวหนึ่งรายการต่อการจองหนึ่งระเบียนเมื่อจองสำเร็จ
- `src/lib/booking/my-bookings.ts` — เข้าคิวอีเมลยกเลิกเมื่อผู้ใช้ยกเลิกการจองของตัวเอง
- `src/lib/admin/booking-admin.ts` — เข้าคิวอีเมลยกเลิกเมื่อแอดมินยกเลิก หรือแก้สถานะเป็น `CANCELLED`
- `drizzle/0003_notification_outbox_cron.sql` — ติดตั้ง pg_cron/pg_net และตั้ง job
