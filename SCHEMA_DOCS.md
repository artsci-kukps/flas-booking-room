# คำอธิบาย Schema แต่ละตารางและแต่ละคอลัมน์

## 1. Enums

| Enum                  | ค่า                                                                     | จุดประสงค์                                                                                         |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `user_role`           | `user`, `admin`                                                         | แยกบทบาทผู้ใช้งานในระบบ                                                                            |
| `reservation_status`  | `PENDING`, `ACTIVE`, `COMPLETED`, `LATE_RETURN`, `CANCELLED`, `NO_SHOW` | วงจรชีวิตของการจองและสถานะที่ครองช่วงเวลา (`PENDING`, `ACTIVE`)                                    |
| `booking_mode`        | `EXCLUSIVE`, `CAPACITY`                                                 | โหมดการจองของประเภทห้อง (`EXCLUSIVE` = ห้ามทับ เช่น G/P, `CAPACITY` = ทับได้จนครบความจุ เช่น S)    |

---

## 2. `users`

**จุดประสงค์:** จัดเก็บผู้ใช้งานที่ล็อกอินผ่าน OAuth (จำกัดเฉพาะ `@ku.th`) ห้ามลบข้อมูลผู้ใช้ เพื่อคงประวัติการจอง ตรวจสอบการบล็อกผู้ใช้และร่องรอยการกระทำ

| คอลัมน์         | ประเภท                                                        | NULL | ค่าเริ่มต้น | จุดประสงค์                                                             |
| --------------- | ------------------------------------------------------------- | ---- | ----------- | ---------------------------------------------------------------------- |
| `id`            | `varchar(255)` (PK)                                           | ไม่  | —           | ใช้ค่า `uid` จาก Supabase Auth เดียวกันกับ auth.users เพื่อลิงก์ข้อมูล |
| `email`         | `varchar(255)` (UNIQUE) + CHECK `lower(email) LIKE '%@ku.th'` | ไม่  | —           | อีเมลผู้ใช้ บังคับโดเมน `@ku.th` 2 ชั้น (server + DB)                  |
| `full_name`     | `varchar(255)`                                                | ใช่  | —           | ชื่อ-นามสกุลจาก OAuth (ถ้ามี)                                          |
| `image_url`     | `varchar(255)`                                                | ใช่  | —           | รูปโปรไฟล์จาก OAuth (ถ้ามี)                                            |
| `role`          | `user_role`                                                   | ไม่  | `user`      | บทบาท `user` หรือ `admin`                                              |
| `is_blocked`    | `boolean`                                                     | ไม่  | `false`     | สถานะบล็อกการเข้าถึง แทนการลบผู้ใช้                                    |
| `blocked_at`    | `timestamptz`                                                 | ใช่  | —           | เวลาที่ถูกบล็อก                                                        |
| `blocked_by`    | `varchar(255)` FK -> `users(id)`                              | ใช่  | —           | ผู้ดูแลที่ทำการบล็อก                                                   |
| `last_login_at` | `timestamptz`                                                 | ใช่  | —           | เวลาล็อกอินล่าสุด (สำหรับตรวจสอบ/วิเคราะห์)                            |
| `created_at`    | `timestamptz`                                                 | ไม่  | `now()`     | เวลาที่สร้างบัญชี                                                      |

**ข้อสังเกต:** ไม่มี `deleted_at` ตามกฎ "ห้ามลบผู้ใช้"

---

## 3. `room_type`

**จุดประสงค์:** กำหนดประเภทห้อง (S/G/P) พร้อมกติกาการจองต่อประเภท เช่น `booking_mode`, `min_duration_minutes` เพื่อให้ระบบอ่านกฎจากข้อมูลแทน hardcode

| คอลัมน์                | ประเภท                                                | NULL | ค่าเริ่มต้น         | จุดประสงค์                                                   |
| ---------------------- | ----------------------------------------------------- | ---- | ------------------- | ------------------------------------------------------------ |
| `id`                   | `uuid` (PK)                                           | ไม่  | `gen_random_uuid()` | ไอดีประเภทห้อง                                               |
| `code`                 | `varchar(1)` (UNIQUE partial: `deleted_at IS NULL`)   | ไม่  | —                   | รหัสย่อ `S`, `G`, `P` ใช้เป็น identity ของประเภท             |
| `type_name`            | `varchar(100)` (UNIQUE partial: `deleted_at IS NULL`) | ไม่  | —                   | ชื่อประเภทห้อง (แสดงใน UI)                                   |
| `booking_mode`         | `booking_mode`                                        | ไม่  | —                   | กำหนดโหมดการจอง: `CAPACITY` สำหรับ S, `EXCLUSIVE` สำหรับ G/P |
| `min_duration_minutes` | `integer` CHECK > 0                                   | ไม่  | `60`                | ระยะเวลาขั้นต่ำต่อการจอง 1 รายการ (S/P=60, G=120)            |
| `created_at`           | `timestamptz`                                         | ไม่  | `now()`             | เวลาสร้าง                                                    |
| `deleted_at`           | `timestamptz`                                         | ใช่  | —                   | ใช้ soft delete                                              |
| `deleted_by`           | `varchar(255)` FK -> `users(id)`                      | ใช่  | —                   | ผู้ที่ลบประเภทห้อง                                           |

**Index/Rule:** `room_type_code_unique`, `room_type_name_unique` เฉพาะที่ยังไม่ลบ (อนุญาตสร้างชื่อเดิมหลัง restore)
**Guard:** trigger `room_type_guard_delete` ห้าม soft delete ประเภทห้องที่ยังมีห้องที่ใช้งานอยู่ (`rooms.deleted_at IS NULL`) — โยน `restrict_violation`

---

## 4. `rooms`

**จุดประสงค์:** จัดเก็บห้องแต่ละห้องที่สามารถจองได้ ผูกกับ `room_type` ระบุความจุ (เฉพาะ S) และสิ่งอำนวยความสะดวก รองรับ soft delete + restore

| คอลัมน์        | ประเภท                                                | NULL | ค่าเริ่มต้น         | จุดประสงค์                                                                                                                                      |
| -------------- | ----------------------------------------------------- | ---- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `uuid` (PK)                                           | ไม่  | `gen_random_uuid()` | ไอดีห้อง                                                                                                                                        |
| `room_type_id` | `uuid` FK -> `room_type(id)`                          | ไม่  | —                   | ผูกห้องเข้ากับประเภทห้อง (อ่าน `booking_mode`, `min_duration_minutes`)                                                                          |
| `name`         | `varchar(100)` (UNIQUE partial: `deleted_at IS NULL`) | ไม่  | —                   | ชื่อห้อง (ต้องไม่ซ้ำในกลุ่มที่ยังใช้งานอยู่)                                                                                                    |
| `max_capacity` | `integer` CHECK > 0 (ถ้า NOT NULL)                    | ใช่  | —                   | **สำคัญสำหรับห้อง S (`CAPACITY`)** — จำนวนคนสูงสุดที่จองทับกันได้ในช่วงเวลาเดียวกัน (app ต้องบังคับให้ไม่ NULL เมื่อ `booking_mode = CAPACITY`) |
| `facilities`   | `text`                                                | ใช่  | —                   | รายละเอียดสิ่งอำนวยความสะดวกในห้อง                                                                                                              |
| `created_at`   | `timestamptz`                                         | ไม่  | `now()`             | เวลาสร้าง                                                                                                                                       |
| `deleted_at`   | `timestamptz`                                         | ใช่  | —                   | soft delete (ห้องที่ถูกลบไม่สามารถจองได้)                                                                                                       |
| `deleted_by`   | `varchar(255)` FK -> `users(id)`                      | ใช่  | —                   | ผู้ที่ลบห้อง                                                                                                                                    |

**Index:** `rooms_name_unique` เฉพาะ `deleted_at IS NULL`

---

## 5. `reservation`

**จุดประสงค์:** จัดเก็บการจองแต่ละรายการ (อาจเป็น 1 record ที่ครอบหลายบล็อกติดกัน) มี `booking_code` ต่อวัน, สถานะ lifecycle, การรับ-คืนกุญแจ, การยกเลิก และมี constraint+trigger เพื่อบังคับกติกา conflict

| คอลัมน์           | ประเภท                              | NULL | ค่าเริ่มต้น         | จุดประสงค์                                                                                                                                               |
| ----------------- | ----------------------------------- | ---- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `uuid` (PK)                         | ไม่  | `gen_random_uuid()` | ไอดีการจอง                                                                                                                                               |
| `user_id`         | `varchar(255)` FK -> `users(id)`    | ไม่  | —                   | ผู้จอง                                                                                                                                                   |
| `room_id`         | `uuid` FK -> `rooms(id)`            | ไม่  | —                   | ห้องที่จอง                                                                                                                                               |
| `booking_mode`    | `booking_mode`                      | ไม่  | —                   | **denormalized** จาก `room_type` ผ่าน trigger `reservation_set_derived` (ป้องกัน spoof) ใช้ใน exclusion constraint `EXCLUSIVE`                           |
| `booking_date`    | `date`                              | ไม่  | —                   | **วันที่ของการจองใน Asia/Bangkok** คำนวณจาก `(start_time AT TIME ZONE 'Asia/Bangkok')::date` โดย trigger ใช้สำหรับ UNIQUE `(booking_code, booking_date)` |
| `booking_code`    | `varchar(6)` CHECK `~ '^[0-9]{6}$'` | ไม่  | —                   | รหัสยืนยัน 6 หลัก **ห้ามซ้ำเฉพาะในวันเดียวกัน** (UNIQUE `reservation_code_per_day`), ส่งทางอีเมล                                                         |
| `start_time`      | `timestamptz`                       | ไม่  | —                   | เวลาเริ่มการจอง (ตาม slot 1 ชั่วโมง)                                                                                                                     |
| `end_time`        | `timestamptz`                       | ไม่  | —                   | เวลาสิ้นสุดการจอง (CHECK `end_time > start_time`)                                                                                                        |
| `status`          | `reservation_status`                | ไม่  | `PENDING`           | สถานะปัจจุบัน: `PENDING/ACTIVE` = ครองช่วงเวลา, อื่น ๆ = ไม่ครอง                                                                                         |
| `key_entered_at`  | `timestamptz`                       | ใช่  | —                   | เวลาที่แอดมินยืนยันการรับกุญแจ                                                                                                                           |
| `key_entered_by`  | `varchar(255)` FK -> `users(id)`    | ใช่  | —                   | แอดมินที่จ่ายกุญแจ                                                                                                                                       |
| `key_returned_at` | `timestamptz`                       | ใช่  | —                   | เวลาที่แอดมินยืนยันการคืนกุญแจ                                                                                                                           |
| `key_returned_by` | `varchar(255)` FK -> `users(id)`    | ใช่  | —                   | แอดมินที่รับคืนกุญแจ                                                                                                                                     |
| `canceled_at`     | `timestamptz`                       | ใช่  | —                   | เวลาที่ยกเลิก                                                                                                                                            |
| `canceled_by`     | `varchar(255)` FK -> `users(id)`    | ใช่  | —                   | ผู้ยกเลิก (ผู้ใช้หรือแอดมิน)                                                                                                                             |
| `canceled_reason` | `text`                              | ใช่  | —                   | เหตุผลการยกเลิก                                                                                                                                          |
| `created_at`      | `timestamptz`                       | ไม่  | `now()`             | เวลาสร้างการจอง                                                                                                                                          |

**Constraints/Indexes ที่สำคัญ (custom migration):**

- `reservation_time_validity`: `end_time > start_time`
- `reservation_code_digits`: รูปแบบตัวเลข 6 หลัก
- `reservation_code_per_day`: UNIQUE `(booking_code, booking_date)` — ซ้ำข้ามวันได้
- `reservation_room_exclusive` (EXCLUDE USING gist): ห้องเดียวกัน + `tstzrange(start,end,'[)')` ทับซ้อน **เฉพาะ** `booking_mode='EXCLUSIVE'` และ `status IN ('PENDING','ACTIVE')`
- `reservation_user_no_overlap` (EXCLUDE USING gist): ผู้ใช้เดียวกัน + ช่วงเวลาทับซ้อน **เฉพาะ** `status IN ('PENDING','ACTIVE')` (ทุกประเภท)
- `reservation_room_range_idx` (GIST): `(room_id, tstzrange(start,end,'[)'))` ช่วย query นับความจุ S และตรวจสอบ conflict
- `reservation_status_start_idx`, `reservation_user_time_idx`, `reservation_booking_date_idx`: ช่วยค้นหา/cron (`NO_SHOW`), ประวัติ, ค้นหาตามวัน

**Trigger:** `reservation_set_derived` (BEFORE INSERT/UPDATE of room_id,start_time) → ดึง `booking_mode` จาก `room_type` ผ่าน `rooms` แล้วเซ็ต `booking_date = (start_time AT TIME ZONE 'Asia/Bangkok')::date`

---

## 6. `service_period`

**จุดประสงค์:** จัดเก็บช่วงเวลาเปิด-ปิดระดับระบบ (NORMAL/EXAM) ตามช่วงวันที่ (`effective_from`–`effective_to`) เพื่อให้แอดมินปรับช่วงสอบได้โดยไม่แตะโค้ด และใช้ตัดสินเวลาเปิด-ปิดของวันนั้น

| คอลัมน์          | ประเภท                           | NULL | ค่าเริ่มต้น         | จุดประสงค์                                                                                      |
| ---------------- | -------------------------------- | ---- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `id`             | `uuid` (PK)                      | ไม่  | `gen_random_uuid()` | ไอดีช่วงเวลา                                                                                    |
| `name`           | `varchar(100)`                   | ไม่  | —                   | ชื่อช่วง เช่น "ภาคปกติ", "ช่วงสอบกลางภาค"                                                       |
| `kind`           | `varchar(16)` CHECK `IN ('NORMAL','EXAM')` | ไม่  | —                   | `NORMAL` หรือ `EXAM` (เก็บเป็น varchar เพราะ exclusion ต้องใช้ค่าใน index)                      |
| `open_time`      | `time`                           | ไม่  | —                   | เวลาเปิด (เช่น 08:30)                                                                           |
| `close_time`     | `time`                           | ไม่  | —                   | เวลาปิด (เช่น 16:30 หรือ 20:30) CHECK `close_time > open_time`                                  |
| `effective_from` | `date`                           | ไม่  | —                   | วันที่เริ่มมีผล                                                                                 |
| `effective_to`   | `date`                           | ใช่  | —                   | วันที่สิ้นสุดมีผล (`NULL` = มีผลต่อไปเรื่อย ๆ) CHECK `effective_to >= effective_from` หรือ NULL |
| `created_by`     | `varchar(255)` FK -> `users(id)` | ไม่  | —                   | ผู้สร้าง                                                                                        |
| `created_at`     | `timestamptz`                    | ไม่  | `now()`             | เวลาสร้าง                                                                                       |

**Constraint (custom):** `service_period_no_overlap` (EXCLUDE USING gist)

- `kind WITH =` และ `daterange(effective_from, COALESCE(effective_to,'infinity'::date), '[]') WITH &&`
- ครอบทุกแถว (ไม่มี soft delete — ลบจริง)
- หมายความ: **NORMAL ห้ามทับ NORMAL, EXAM ห้ามทับ EXAM** แต่ **EXAM ทับ NORMAL ได้**
- **กติกาตัดสิน:** ถ้าวันนั้นอยู่ในช่วง `EXAM` ใด ๆ (ที่ยังไม่ลบ) ให้ใช้ `EXAM` ที่มีผลล่าสุด มิฉะนั้นใช้ `NORMAL`

---

## 7. `holiday`

**จุดประสงค์:** จัดเก็บวันหยุดระดับระบบ (วันหยุดนักขัตฤกษ์) ซึ่งระบบจะ **ปิดทุกห้อง** ในวันนั้น (เสาร์-อาทิตย์ คำนวณในโค้ด ไม่ต้องใส่ในตารางนี้)

| คอลัมน์        | ประเภท                                        | NULL | ค่าเริ่มต้น         | จุดประสงค์                     |
| -------------- | --------------------------------------------- | ---- | ------------------- | ------------------------------ |
| `id`           | `uuid` (PK)                                   | ไม่  | `gen_random_uuid()` | ไอดีวันหยุด                    |
| `holiday_date` | `date` UNIQUE                                       | ไม่  | —                   | วันที่หยุด                     |
| `name`         | `varchar(200)`                                | ไม่  | —                   | ชื่อวันหยุด เช่น "วันสงกรานต์" |
| `note`         | `text`                                        | ใช่  | —                   | หมายเหตุเพิ่มเติม              |
| `created_by`   | `varchar(255)` FK -> `users(id)`              | ไม่  | —                   | ผู้สร้าง                       |
| `created_at`   | `timestamptz`                                 | ไม่  | `now()`             | เวลาสร้าง                      |

**Index:** `holiday_date_unique` (UNIQUE แบบไม่มีเงื่อนไข — ลบจริง)

---

## 8. `room_block`

**จุดประสงค์:** บล็อกเฉพาะห้องในช่วงเวลาที่กำหนด (ปิดปรับปรุง ฯลฯ) ผู้ใช้ไม่สามารถจองช่วงเวลาที่ทับซ้อนกับ room_block ได้

| คอลัมน์      | ประเภท                           | NULL | ค่าเริ่มต้น         | จุดประสงค์                                     |
| ------------ | -------------------------------- | ---- | ------------------- | ---------------------------------------------- |
| `id`         | `uuid` (PK)                      | ไม่  | `gen_random_uuid()` | ไอดีการบล็อก                                   |
| `room_id`    | `uuid` FK -> `rooms(id)`         | ไม่  | —                   | ห้องที่ถูกบล็อก                                |
| `start_time` | `timestamptz`                    | ไม่  | —                   | เวลาเริ่มบล็อก                                 |
| `end_time`   | `timestamptz`                    | ไม่  | —                   | เวลาสิ้นสุดบล็อก CHECK `end_time > start_time` |
| `reason`     | `text`                           | ไม่  | —                   | เหตุผลการบล็อก (บังคับกรอก)                    |
| `created_by` | `varchar(255)` FK -> `users(id)` | ไม่  | —                   | ผู้สร้าง (แอดมิน)                              |
| `created_at` | `timestamptz`                    | ไม่  | `now()`             | เวลาสร้าง                                      |

**Constraint (custom):** `room_block_no_overlap` (EXCLUDE USING gist)

- `(room_id WITH =, tstzrange(start_time,end_time,'[)') WITH &&)` ครอบทุกแถว (ลบจริง)
- ห้ามมีรายการบล็อกที่ **ทับซ้อนกัน** ในห้องเดียวกัน

---

## 9. การกู้คืนข้อมูล (Restore / Reuse)

Soft delete ใช้เฉพาะตาราง `rooms` และ `room_type` เท่านั้น (ดูข้อ 3 และ 4) ส่วน `service_period`, `holiday`, `room_block` **ลบจริง**

**Restore = reuse แถวเดิม:** เมื่อเพิ่มห้อง/ประเภทห้องที่ชื่อหรือรหัสตรงกับแถวที่ถูกลบอยู่ ให้กู้คืนแถวเดิม (ตั้ง `deleted_at = NULL`, `deleted_by = NULL`) แทนการสร้างแถวใหม่ เพื่อรักษา FK จาก `reservation`/`rooms` ในอดีต

แนวทาง implement: ลอง `INSERT` ก่อน → ถ้าชน unique violation (`23505`) ให้หาแถวที่ `deleted_at IS NOT NULL` ซึ่งตรงกับชื่อ/รหัส แล้ว `UPDATE` กู้คืน

**Audit Trail:** เวอร์ชันแรกยังไม่มีตาราง `audit_log` รวม (เลื่อนไปเฟสถัดไปเพื่อประหยัดพื้นที่) — อาศัยคอลัมน์บนแถวข้อมูลแทน เช่น `blocked_at/by`, `canceled_at/by/reason`, `key_entered_by/at`, `key_returned_by/at`, `deleted_at/by`, `created_by`, `created_at`
