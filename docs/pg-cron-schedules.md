# ตารางเวลา pg_cron

เอกสารนี้บันทึก **ตารางเวลา pg_cron ที่ตกลง** (TOR ภาคผนวก B.3) พร้อมเหตุผล
ใช้เป็นแหล่งอ้างอิงเดียวของ job ทั้งหมดที่รันในฐานข้อมูล

---

## 1. `reservation-no-show` — ตั้งสถานะ NO_SHOW อัตโนมัติ (ตั๋ว #13)

| หัวข้อ | ค่า |
| --- | --- |
| Job name | `reservation-no-show` |
| ตารางเวลา | `* * * * *` (ทุกนาที ทุกวัน) |
| คำสั่ง | `SELECT mark_no_show_reservations();` |
| ฟังก์ชัน | `mark_no_show_reservations()` (ประกาศใน `drizzle/0002_no_show_cron.sql`) |
| กติกา | `status = 'PENDING'` และ `start_time + interval '30 minutes' <= now()` → `NO_SHOW` |
| Timezone อ้างอิง | Asia/Bangkok (ระบบทั้งหมด) |

### ทำไมเลือก "ทุกนาที"

- **ความหมายทางธุรกิจ:** เมื่อครบ 30 นาที ช่องว่างต้องถูกปล่อยให้คนอื่นจองได้ทันที
  ความถี่ระดับนาทีทำให้ดีเลย์สูงสุด ~1 นาที (`pg_cron` มีความละเอียดต่ำสุด 1 นาที)
  ถ้าเลือกทุก 5/15 นาที ช่องจะถูกกักไว้เกินจำเป็นโดยไม่มีเหตุผล
- **งานเบา:** เป็น `UPDATE` เงื่อนไขเดียวบน index `reservation_status_start_idx (status, start_time)`
  ปกติไม่มีแถวเข้าเงื่อนไข (0 แถว) จึงไม่มีต้นทุนนัยสำคัญ
- **ไม่ผูก timezone:** `pg_cron` ตีความ cron expression เป็น UTC เสมอ (ค่าตั้ง `cron.timezone`
  ไม่มีผลกับจังหวะการรัน) การรันทุกนาทีทำให้จังหวะไม่ขึ้นกับ timezone เลย
- **เกณฑ์ตัดสินเป็น instant:** `start_time + 30 นาที` เทียบกับ `now()` เป็นการเทียบค่า instant
  ไม่ใช่ตัวเลขวันที่ จึงให้ผลเหมือนกันทุก timezone และไม่พังเมื่อข้ามเที่ยงคืน
  (ดูเทสต์ขอบเขตเที่ยงคืน Asia/Bangkok ใน `src/lib/booking/no-show.test.ts`)

### การปล่อยช่องว่าง

เมื่อแถวกลายเป็น `NO_SHOW` ช่องว่างจะถูกปล่อยทันที เพราะ constraint
`reservation_room_exclusive` และ `reservation_user_no_overlap` นับเฉพาะ
`status IN ('PENDING','ACTIVE')` (TOR A.5, ข้อ 6.2) — `NO_SHOW` ไม่อยู่ในชุดสถานะที่ครองช่วงเวลา
(`OCCUPYING_STATUSES` ใน `src/lib/booking/day-availability.ts`)

### การตรวจสอบย้อนหลัง (operations)

```sql
-- ดู job ที่ลงทะเบียนไว้
SELECT jobid, jobname, schedule, command, active FROM cron.job;

-- ดูประวัติการรันล่าสุด (จำนวนแถวที่ถูกเปลี่ยนอยู่ใน `return_message`)
SELECT jobid, status, return_message, start_time
  FROM cron.job_run_details
 WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'reservation-no-show')
 ORDER BY start_time DESC
 LIMIT 20;
```

### หมายเหตุ Supabase

บน Supabase ให้เปิดส่วนขยาย `pg_cron` (Dashboard → Database → Extensions) ก่อน
migration `0002_no_show_cron.sql` มี `CREATE EXTENSION IF NOT EXISTS pg_cron;` กันกรณีอื่นอยู่แล้ว

---

## 2. `notification-outbox-dispatch` — ส่งอีเมลรหัสการจองและ retry (ตั๋ว #14)

| หัวข้อ | ค่า |
| --- | --- |
| Job name | `notification-outbox-dispatch` |
| ตารางเวลา | `* * * * *` (ทุกนาที ทุกวัน) |
| คำสั่ง | `SELECT net.http_post(url := current_setting('app.outbox_url', true), ...)` |
| ปลายทาง | `POST /api/cron/outbox` ของแอป (worker ใน `src/app/api/cron/outbox/route.ts`) |
| ยืนยันตัวตน | header `Authorization: Bearer <app.cron_secret>` (เทียบกับ `CRON_SECRET` ของแอป) |
| ตาราง/นโยบาย | นโยบาย retry และรูปแบบอีเมลอยู่ใน [`docs/notifications/outbox.md`](notifications/outbox.md) |
| Timezone อ้างอิง | Asia/Bangkok (การจัดรูปแบบวัน/เวลาเป็นหน้าที่ชั้นแอป) |

### ทำไม pg_cron ต้องยิงเข้าแอป

`pg_cron` ส่งอีเมล (HTTP ไป Resend) เองไม่ได้ ต้องอาศัย `pg_net` ยิงออกไปที่ worker ของแอป
worker จึงเป็นคนสร้างเนื้ออีเมล เรียก Resend แล้วอัปเดต `SENT` / retry / `FAILED`
ในตาราง `notification_outbox` (เลือกงานด้วย index `outbox_pending_idx`)

### ทำไมเลือก "ทุกนาที"

- **ความหมายทางธุรกิจ:** ต้องส่งรหัสให้ผู้จองเร็วที่สุดหลังจองสำเร็จ และต้อง retry ได้ตามนโยบาย
  ความถี่ระดับนาทีคือความละเอียดต่ำสุดของ `pg_cron` และทำให้ดีเลย์สูงสุด ~1 นาที
- **งานเบา:** query เลือกเฉพาะ `PENDING` ที่ถึงเวลา (ปกติ 0 แถว) บน index `outbox_pending_idx (status, next_attempt_at)`
- **ไม่ผูก timezone:** ความถี่ระดับนาทีทำให้จังหวะไม่ขึ้นกับ timezone (การแสดงวัน/เวลาเป็น Asia/Bangkok ที่ชั้นแอป)

### การตั้งค่าและตรวจสอบย้อนหลัง (operations)

ตั้งค่า GUC ต่อฐานข้อมูลก่อนใช้งาน (ถ้าไม่ตั้ง `app.outbox_url` งานจะไม่ยิงอะไรเลย):

```sql
ALTER DATABASE <db> SET app.outbox_url  = 'https://<app>/api/cron/outbox';
ALTER DATABASE <db> SET app.cron_secret = '<CRON_SECRET>';
```

```sql
-- ดู job ที่ลงทะเบียนไว้
SELECT jobid, jobname, schedule, command, active FROM cron.job;

-- ดูประวัติการรันล่าสุด (ผลรวม sent/retried/failed อยู่ใน body ของ net._http_response)
SELECT jobid, status, return_message, start_time
  FROM cron.job_run_details
 WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'notification-outbox-dispatch')
 ORDER BY start_time DESC
 LIMIT 20;
```
