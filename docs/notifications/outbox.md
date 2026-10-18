# คิวแจ้งเตือนและอีเมลรหัสการจอง (`notification_outbox`)

เอกสารนี้อธิบายค่าที่ตัดสินในตั๋ว **#14** สำหรับภาคผนวก B ข้อ 2 (รูปแบบ/ภาษา/หัวข้ออีเมล และนโยบาย retry)
และข้อ 3 (ตารางเวลา `pg_cron`) ของ `TOR.md`

## ภาพรวมการทำงาน

```
จองสำเร็จ (createReservation)
  └─ เข้าคิว: INSERT notification_outbox (type = BOOKING_CODE, status = PENDING, next_attempt_at = now())
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

## รูปแบบอีเมล (ภาคผนวก B.2)

| หัวข้อ | ค่าที่ตัดสิน |
| --- | --- |
| ภาษา | ไทยล้วน (ทั้งหัวเรื่องและเนื้อหา) |
| หัวเรื่อง | `รหัสการจอง Creative Space: <รหัส 6 หลัก>` |
| โครงเนื้อหา | หัวข้อ "จองห้องสำเร็จ" → รหัสตัวใหญ่ในกรอบสีเขียว KU (#e9f4ee) → ชื่อห้อง → วันเวลาไทย (Asia/Bangkok) รูปแบบ `19 ต.ค. 2569 · 09:30–10:30 น.` → คำแนะนำให้แสดงรหัสกับเจ้าหน้าที่ ณ จุดรับกุญแจ → หมายเหตุว่ารหัสอยู่ในหน้ายืนยันบนจอเสมอ |
| ข้อความล้วน | มี `text` คู่กับ `html` เสมอ (ไคลเอนต์ที่ไม่เรนเดอร์ HTML) |
| ผู้ส่ง | จาก `RESEND_FROM` (เช่น `Creative Space <booking@ku.th>`) |
| เทมเพลต | `src/services/emails/booking-code.ts` (ใช้เชลล์กลาง `emails/layout.ts` — flat design เดียวกับหน้าเว็บ, ไม่มีปุ่ม CTA, ไม่มีเงา) |
| เขตเวลา | แสดงผลเป็น Asia/Bangkok เสมอ ผ่าน `src/lib/format.ts` — ไม่พึ่ง timezone ของเซิร์ฟเวอร์ |

## นโยบาย retry (ภาคผนวก B.2)

- พยายามส่งสูงสุด **5 ครั้ง** ต่อหนึ่งรายการ (`MAX_OUTBOX_ATTEMPTS = 5` ใน `src/lib/notifications/outbox.ts`)
- ระยะห่างก่อนลองใหม่หลังล้มเหลวครั้งที่ 1–4: **1, 5, 15, 60 นาที** (`OUTBOX_RETRY_DELAYS_MS`)
  รวมเวลาถึงจุดยอมแพ้ประมาณ 81 นาที นับจากความพยายามครั้งแรก
- ล้มเหลวครั้งที่ 5 → `status = FAILED` และเก็บข้อความ error ไว้ที่ `last_error` (ตัดที่ 1000 ตัวอักษร) โดยไม่ตั้ง `next_attempt_at` ใหม่
- ระหว่างรอ retry รายการยังเป็น `PENDING` และถูกข้ามจนกว่า `next_attempt_at` จะถึง
- **payload ผิดรูปแบบ** (สร้างอีเมลไม่ได้) ถือเป็นความผิดพลาดถาวร → `FAILED` ทันที ไม่เสียเวลา retry
- เลือกงานด้วย index `outbox_pending_idx (status, next_attempt_at)` และจำกัดรอบละ 20 รายการ (`OUTBOX_BATCH_SIZE`)

## ตารางเวลา `pg_cron` (ภาคผนวก B.3)

- job `notification-outbox-dispatch` ทำงาน **ทุก 1 นาที** (`* * * * *`)
- เพราะเป็นงานยิงตามนาที ตารางเวลาจึงไม่ขึ้นกับ timezone; จุดที่ต้องเป็น Asia/Bangkok (การแสดงวัน/เวลา
  ของการจอง) จัดการในชั้นแอปแล้ว (ดูข้อ TOR เรื่องเขตเวลา)
- ประกาศไว้ใน `drizzle/0002_notification_outbox_cron.sql` (custom migration — `CREATE EXTENSION` /
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
- `src/services/emails/booking-code.ts` — เทมเพลตอีเมลรหัสการจอง
- `src/services/resend.service.ts` — ตัวส่งผ่าน Resend (ฉีด fetch ได้, ไม่ยิงเครือข่ายในเทสต์)
- `src/app/api/cron/outbox/route.ts` — worker endpoint สำหรับ pg_cron (ป้องกันด้วย `CRON_SECRET`)
- `src/lib/booking/reservations.ts` — เข้าคิวหนึ่งรายการต่อการจองหนึ่งระเบียนเมื่อจองสำเร็จ
- `drizzle/0002_notification_outbox_cron.sql` — ติดตั้ง pg_cron/pg_net และตั้ง job
