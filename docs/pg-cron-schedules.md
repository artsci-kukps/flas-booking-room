# ตารางเวลา pg_cron

เอกสารนี้บันทึก **ตารางเวลา pg_cron ที่ตกลง** (TOR ภาคผนวก B.3) พร้อมเหตุผล
ใช้เป็นแหล่งอ้างอิงเดียวของ job ทั้งหมดที่รันในฐานข้อมูล

> **หมายเหตุเรื่อง timezone (สำคัญ):** `cron.timezone` เป็น GUC ที่ `pg_cron`
> อ่านตอนเริ่ม postmaster (postmaster context) จึงตั้งได้เฉพาะด้วย
> `ALTER SYSTEM SET cron.timezone = '<tz>';` แล้ว **restart ฐานข้อมูล** — ตั้งจาก migration ไม่ได้
> job ด้านล่างเลือกความถี่ "ทุกนาที" และใช้เกณฑ์ตัดสินเป็น instant
> (`now()` เทียบกับค่าที่คำนวณจากแถว) ไม่ใช่ปฏิทินวัน จึงให้ผลเหมือนกันทุก timezone
> โดยไม่ต้องตั้ง `cron.timezone` เลย

> **ไม่มี job สำหรับอีเมลแล้ว:** ตั้งแต่ #24 ระบบส่งอีเมล (รหัสการจอง/แจ้งยกเลิก)
> **ทันทีผ่าน SMTP (nodemailer)** ใน request path หลัง DB commit แทนการเข้าคิว
> จึงลบตาราง `notification_outbox` และ job `notification-outbox-dispatch` ออกแล้ว
> (ดูรายละเอียดการแจ้งเตือนใน `TOR.md` ข้อ 11)

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

`pg_net` ยังคงเปิดไว้ในฐานข้อมูล แต่ไม่มี job ไหนใช้งานแล้ว (เดิมใช้ยิง HTTP ไปที่ worker
ของ outbox) — จะปิดก็ได้หากต้องการลดส่วนขยายที่ไม่ได้ใช้
