# ระบบจองห้องทำงาน — เอกสารกำหนดขอบเขตและรายละเอียดโครงการ (Terms of Reference: TOR)

> **ฉบับปรับปรุง:** รวบรวมผลการวิเคราะห์และข้อตกลงการออกแบบ (business rule freeze + data model)
> **สถานะ:** กติกาธุรกิจได้รับการยืนยันครบแล้ว · ยังไม่เริ่มพัฒนา
> **Timezone อ้างอิง:** Asia/Bangkok (การคำนวณ "วัน", slot, วันหยุด ทั้งหมดใช้เขตเวลานี้)

---

## 1. ภาพรวมและขอบเขต

ระบบสำหรับจองห้องทำงานภายในมหาวิทยาลัย ผู้ใช้ยืนยันตัวตนด้วยบัญชีอีเมลมหาวิทยาลัย (`@ku.th`) เท่านั้น
ระบบรองรับการจองเป็นช่วงบล็อก (ความยาวของบล็อกเท่ากับระยะเวลาขั้นต่ำของประเภทห้องตามข้อ 4) การรับ–คืนกุญแจ การบล็อกห้อง/วันหยุด และการตรวจสอบย้อนหลัง

---

## 2. เทคโนโลยีที่ใช้ (Technology Stack)

- **Frontend / API:** Next.js (App Router) + TypeScript
- **Database:** PostgreSQL (Supabase) — เข้าถึงผ่าน **Drizzle ORM แบบ server-only** (server component / server action)
  - ตรวจเงื่อนไขทางธุรกิจทั้งหมดฝั่ง server
  - **ไม่เปิด RLS** ให้ client เข้าถึงตารางโดยตรง
- **Authentication:** Supabase Auth (OAuth) จำกัดโดเมน `@ku.th`
- **อีเมล:** SMTP ผ่าน nodemailer (ส่งทันที: OTP, รหัสการจอง, แจ้งยกเลิก)
- **ตัวจัดตารางงาน:** `pg_cron` (ตั้งสถานะ `NO_SHOW`, ยิงส่งอีเมลจากคิว)
- **ไดรเวอร์/UUID:** ใช้ `gen_random_uuid()` (built-in) แทน `uuid_generate_v4()`

---

## 3. การเข้าสู่ระบบและบทบาทผู้ใช้

### 3.1 การเข้าสู่ระบบ
- เข้าสู่ระบบผ่าน OAuth และ **อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย `@ku.th`**
- บังคับเงื่อนไข **2 ชั้น**:
  1. ส่งค่า `hd=ku.th` ไปกับ OAuth (Google Workspace domain hint)
  2. ตรวจ suffix ของอีเมลที่ server อีกครั้ง **ก่อน** upsert เข้าตาราง `users` — ถ้าไม่ใช่ ให้ปฏิเสธ

### 3.2 บทบาท (Roles)
| บทบาท | สิทธิ์ |
|---|---|
| `user` | จองห้อง และดูประวัติการจองของตนเอง |
| `admin` | แก้ไขเวลาเปิด–ปิด (ช่วงสอบ), จัดการห้อง/ประเภทห้อง/รายละเอียดห้อง, ดูตารางการจอง, ยกเลิกการจอง, บล็อกห้อง, จัดการรับ–คืนกุญแจ, เปลี่ยน role ผู้ใช้, บล็อกผู้ใช้, และ **จองห้องได้เหมือน user** |

### 3.3 การจัดการบัญชีผู้ใช้
- **ห้ามลบผู้ใช้** ออกจากฐานข้อมูลโดยเด็ดขาด เพื่อรักษาความเชื่อมโยงของประวัติการจอง
- ผู้ใช้ที่ถูกบล็อกจะยังอยู่ในฐานข้อมูล แต่เข้าสู่ระบบ/ใช้งานไม่ได้ — บันทึก `is_blocked`, `blocked_at`, `blocked_by`
- **แอดมินคนแรก** เกิดจากการเพิ่มข้อมูลโดยตรงผ่าน DB (seed) หลังจากนั้นแอดมินเป็นผู้เปลี่ยน role ให้เอง
- การเปลี่ยน role และการบล็อก/ปลดบล็อกผู้ใช้ บันทึกผลไว้บนแถวผู้ใช้ (`role`, `is_blocked`, `blocked_at`, `blocked_by`) — เวอร์ชันแรกยังไม่มีตาราง audit รวม (ดูข้อ 12)

---

## 4. ประเภทห้องและกติกาต่อประเภท

ระบบมี 3 ประเภทห้อง:

| ประเภท | รหัส | ความหมาย | โหมดการจอง | ระยะเวลาขั้นต่ำ |
|---|---|---|---|---|
| ห้องทั่วไป | `S` | ห้องนั่งทำงาน/อ่านหนังสือ | `CAPACITY` (จองทับกันได้จนครบความจุ) | 1 ชั่วโมง (1 บล็อก) |
| ห้องประชุมใหญ่ | `G` | ห้องประชุมขนาดใหญ่ | `EXCLUSIVE` (ห้ามจองทับ) | 2 ชั่วโมง (2 บล็อก) |
| ห้องละหมาด | `P` | ห้องละหมาด | `EXCLUSIVE` (ห้ามจองทับ) | 1 ชั่วโมง (1 บล็อก) |

**กติกาเพิ่มเติม**
- **ไม่จำกัดจำนวนครั้ง** ต่อผู้ใช้ และ **ไม่มีโควต้าต่อวัน**
- **ไม่มีเพดานความยาวต่อหนึ่งการจอง** — ผู้ใช้เลือกได้กี่บล็อกก็ได้ (ตามข้อ 6.1)
- กติกาประเภทห้องถูกจัดเก็บเป็นข้อมูล (คอลัมน์บน `room_type`) ไม่ hardcode ในโค้ด เพื่อให้แอดมินดูแลได้

---

## 5. เวลาให้บริการ

### 5.1 ช่วงเวลาเปิด–ปิด
- **วันปกติ (NORMAL):** จันทร์–ศุกร์ 08:30–16:30
- **ช่วงสอบ (EXAM):** จันทร์–ศุกร์ 08:30–20:30
- **ปิด:** วันเสาร์–อาทิตย์ (คำนวณในโค้ด) และวันหยุดนักขัตฤกษ์ (ตาราง `holiday`)

> **หมายเหตุการปรับจากที.โอ.อาร์.เดิม:** เวลาเปิด–ปิดเป็น **ระดับระบบ (global)** ผ่านตาราง `service_period` ไม่ใช่รายห้อง
> เพื่อให้แอดมินแก้ช่วงสอบได้โดยไม่แตะโค้ด และลดความซับซ้อน หากต้องการ override รายห้องในอนาคตสามารถเพิ่มได้ภายหลัง

### 5.2 การเลือกช่วงเวลาที่มีผล
- วันใดอยู่ในช่วง `EXAM` ใด ๆ ให้ใช้เวลาของ `EXAM` ที่สร้างล่าสุด มิฉะนั้นใช้ `NORMAL`
- ช่วง `NORMAL` ห้ามทับกันเอง และช่วง `EXAM` ห้ามทับกันเอง (บังคับด้วย exclusion constraint) แต่ `EXAM` ทับช่วง `NORMAL` ได้

### 5.3 Slot
- หน่วยช่วงเวลาคือ **1 ชั่วโมง** โดยเริ่มจากเวลาเปิดของวันนั้น
  - ตัวอย่าง (เปิด 08:30): `08:30–09:30`, `09:30–10:30`, … , `15:30–16:30` (หรือ `19:30–20:30` ในช่วงสอบ)
- **บล็อกที่ผู้ใช้เลือกยาวเท่าระยะเวลาขั้นต่ำของประเภทห้อง** (ข้อ 4) — ห้องทั่วไป/ละหมาด (S/P) 1 ชั่วโมง, ห้องประชุมใหญ่ (G) 2 ชั่วโมง
  - ตัวอย่าง ห้องประชุมใหญ่ (G) เลือกครั้งเดียวได้ `08:30–10:30` (2 บล็อก) ส่วนห้องทั่วไป (S) เลือก `08:30–09:30`
- ผู้ใช้ **เลือกเป็นบล็อกเท่านั้น ห้ามพิมพ์เวลาเอง**

---

## 6. กติกาการจอง

### 6.1 การเลือกบล็อกและการรวม record
- ผู้ใช้เลือกได้กี่บล็อกก็ได้ (ตามขั้นต่ำของประเภทห้อง) โดยเลือกเป็นบล็อกทีละ 1 ชั่วโมง
- **บล็อกติดกัน → รวมเป็น 1 record** (เช่นเลือก `08:30–09:30` และ `09:30–10:30` → เก็บเป็น `08:30–10:30`)
- **บล็อกที่มีช่องว่าง → แยก record** (เช่น `08:30–09:30` และ `10:30–11:30` → 2 record → ต้องยืนยันกับเจ้าหน้าที่ 2 ครั้ง)
- ระบบต้องตรวจว่าบล็อกที่เลือกติดกันจริงก่อนตัดสินใจรวม record

### 6.2 การป้องกันการจองซ้ำซ้อน (Conflict Prevention)
สถานะที่ **ครองช่วงเวลา** (นับเป็นผู้ใช้ห้อง): `PENDING`, `ACTIVE`
สถานะที่ **ไม่ครอง** (ปล่อยห้อง): `COMPLETED`, `LATE_RETURN`, `CANCELLED`, `NO_SHOW`

- **ห้อง G และ P (`EXCLUSIVE`):** ห้ามมีรายการจองที่ช่วงเวลาทับซ้อนกันในห้องเดียวกัน (บังคับด้วย exclusion constraint ระดับ DB)
- **ห้อง S (`CAPACITY`):** จองทับกันได้ แต่ **จำนวนรายการที่ครองช่วงเวลาซ้อนกัน ต้องไม่เกินความจุ (`max_capacity`) ของห้องนั้น** — ตรวจด้วยการล็อกต่อห้อง (advisory lock) แล้วนับจำนวนก่อนบันทึก
- **ผู้ใช้คนเดียวห้ามมีการจองที่ทับซ้อนกันเอง** (ทุกประเภทห้อง) — เช่น ผู้ใช้คนเดียวไม่สามารถจองห้องมากกว่า 1 ห้องในช่วงเวลาเดียวกัน
- ต้องตรวจ **เวลาเปิด–ปิด, วันหยุด, การบล็อกห้อง, ระยะเวลาขั้นต่ำ และขอบเขต slot** ก่อนยืนยันการจองทุกครั้ง

### 6.3 รหัสการจอง (Booking Code)
- เมื่อจองสำเร็จ ระบบสุ่ม **รหัสตัวเลข 6 หลัก**
- **ห้ามซ้ำเฉพาะการจองในวันเดียวกัน** (ไม่ใช่ห้ามซ้ำตลอดกาล) — ถ้าซ้ำให้สุ่มใหม่
- ระบบส่งรหัสไปยังอีเมลผู้ใช้ เพื่อให้ผู้ใช้ยืนยันกับเจ้าหน้าที่ ณ จุดรับกุญแจ
- การค้นหารายการที่เคาน์เตอร์ให้ **จำกัดขอบเขตที่วันปัจจุบัน** (รับกุญแจในวันที่มีการจอง)

### 6.4 การยกเลิกและการแก้ไข
- **ผู้ใช้:** ยกเลิกการจองของตนเองได้เฉพาะสถานะ `PENDING` และต้องทำก่อนเวลาเริ่ม (`start_time`) — เมื่อเป็น `ACTIVE` แล้วยกเลิกไม่ได้ ต้องคืนกุญแจก่อน
- **แอดมิน:** ยกเลิกการจองได้เสมอ พร้อมระบุเหตุผล (`canceled_at`, `canceled_by`, `canceled_reason`)
- **การแก้ไขเวลา/ห้อง:** ไม่อนุญาตให้แก้ไขตรง ๆ — ต้อง **ยกเลิกการจองเดิมแล้วจองใหม่** เพื่อให้ record เป็น immutable และตรวจสอบย้อนหลังได้ตรงไปตรงมา

---

## 7. สถานะการจองและวงจรชีวิต

| สถานะ | ความหมาย | ครองช่วงเวลา |
|---|---|---|
| `PENDING` | จองแล้ว รอผู้ใช้มารับกุญแจ/ยืนยันกับเจ้าหน้าที่ | ✅ |
| `ACTIVE` | ผู้ใช้รับกุญแจและกำลังใช้งาน | ✅ |
| `COMPLETED` | คืนกุญแจภายในเวลาที่กำหนด | ❌ |
| `LATE_RETURN` | คืนกุญแจช้ากว่ากำหนด | ❌ |
| `CANCELLED` | การจองถูกยกเลิก | ❌ |
| `NO_SHOW` | ผู้ใช้ไม่มารับกุญแจภายในเวลาที่กำหนด (30 นาที) | ❌ |

**การเปลี่ยนสถานะ**
- เริ่มต้นที่ `PENDING` อัตโนมัติเมื่อจองสำเร็จ
- แอดมินยืนยันการรับกุญแจ → `ACTIVE`
- แอดมินยืนยันการคืนกุญแจ → ถ้า `returned_at > end_time` เป็น `LATE_RETURN` มิฉะนั้นเป็น `COMPLETED` (ไม่ auto-complete)
- **`NO_SHOW` อัตโนมัติ:** ถ้ายังเป็น `PENDING` และเวลาผ่านไปเกิน `start_time + 30 นาที` ให้ `pg_cron` ตั้งสถานะเป็น `NO_SHOW`
- **แอดมินสามารถ override สถานะได้เสมอ** เมื่อเกิดข้อผิดพลาด และบันทึกเหตุผล/ผู้ดำเนินการไว้ที่ (`canceled_at`, `canceled_by`, `canceled_reason`) สำหรับการยกเลิก

---

## 8. การรับ–คืนกุญแจ

- ผู้ใช้ต้องแจ้ง **รหัส 6 หลัก** ให้เจ้าหน้าที่เพื่อเข้าใช้งาน
- เมื่อแอดมินกดยืนยันการรับห้อง ระบบบันทึก:
  - `key_entered_by` = ไอดีแอดมินผู้ยืนยัน
  - `key_entered_at` = วันเวลาที่รับกุญแจ
- เมื่อผู้ใช้ใช้งานเสร็จและมาแจ้งคืน ระบบบันทึก:
  - `key_returned_by` = ไอดีแอดมินผู้ยืนยันการคืน
  - `key_returned_at` = วันเวลาที่คืน

---

## 9. การบล็อกห้องและวันหยุด

- **วันหยุดนักขัตฤกษ์ (`holiday`):** ปิดทั้งระบบ — แอดมินเพิ่ม/ลบได้
- **การบล็อกเฉพาะห้อง (`room_block`):** แอดมินกำหนดห้อง + ช่วงเวลา + เหตุผล เพื่อปิดปรับปรุงหรือเหตุอื่น
- ระบบห้ามจองห้องที่ช่วงเวลาทับซ้อนกับ `room_block` และต้องตรวจทุกครั้งก่อนยืนยันการจอง
- ห้ามมีรายการบล็อกที่ทับซ้อนกันในห้องเดียวกัน

---

## 10. การจัดการข้อมูลห้อง

- **Soft delete + Restore: ใช้เฉพาะ `rooms` และ `room_type`**
  - ลบ = ตั้ง `deleted_at` / `deleted_by` (ไม่ลบจริง) — กู้คืน = ล้างค่าดังกล่าว
  - **ห้าม soft delete `room_type` ที่ยังมีห้องที่ใช้งานอยู่** — บังคับด้วย trigger `room_type_guard_delete` ที่ระดับ DB
  - **Restore = นำกลับมาใช้ซ้ำ (reuse):** เมื่อเพิ่มห้อง/ประเภทห้องที่ชื่อหรือรหัสตรงกับแถวที่ถูกลบอยู่ ให้ **กู้คืนแถวเดิม** (ตั้ง `deleted_at = NULL`) แทนการสร้างแถวใหม่ เพื่อรักษา FK ของประวัติย้อนหลัง
    - แนวทาง implement: ลอง `INSERT` ก่อน ถ้าชน unique violation ให้หาแถวที่ถูกลบซึ่งตรงกันแล้ว `UPDATE` กู้คืน
- ตารางอื่น (`room_block`, `holiday`, `service_period`) **ลบจริง (hard delete)** เพราะเป็นข้อมูลเชิงเวลา ไม่ถูกอ้างอิงจากประวัติการจอง
- ห้อง/ประเภทห้องที่ถูกลบต้องไม่ถูกนำไปจอง
- **ชื่อห้อง / ชื่อประเภทห้อง / รหัสประเภทห้อง ห้ามซ้ำเฉพาะรายการที่ยังไม่ถูกลบ** (partial unique index) — ลบแล้วสร้างชื่อเดิมใหม่ได้
- การจองไม่ถูกลบ (ใช้สถานะ `CANCELLED` แทน) และผู้ใช้ไม่ถูกลบ

---

## 11. การแจ้งเตือน

> **ปรับปรุง: 2026-10-26 (#24)** — เลิกใช้คิว `notification_outbox` + pg_cron/Resend
> เปลี่ยนเป็นส่งอีเมล **ทันทีผ่าน SMTP (nodemailer)** ใน request path

- ส่งอีเมลทันที **หลัง DB commit เท่านั้น** — ไม่ส่งภายใน transaction (กันกรณี rollback แล้วอีเมลออกไป)
- เมื่อจองสำเร็จ → ส่งรหัสการจองทางอีเมล **หนึ่งฉบับต่อการจองหนึ่งระเบียน**
- จองหลายบล็อกพร้อมกัน → ส่งหลัง outer transaction commit ครบแล้ว ส่งขนานด้วย `Promise.allSettled`
- เมื่อยกเลิก (ผู้ใช้ยกเลิกเองหรือแอดมินยกเลิก) → ส่งอีเมลแจ้งเตือนพร้อมเหตุผล
  (ผู้ใช้ยกเลิกเองไม่ต้องระบุเหตุผล)
- อีเมลเป็นงานเสริม (**best-effort**): ส่งไม่สำเร็จเพียงบันทึก log — การจอง/ยกเลิกต้องสำเร็จเสมอ
  และหน้ายืนยันยังแสดงรหัสบนจอ
- ไม่มี retry อัตโนมัติ/ตารางคิว: ผู้ใช้เห็นรหัสบนหน้าจอและสามารถติดต่อแอดมินได้หากอีเมลไม่ถึง

---

## 12. การตรวจสอบย้อนหลัง (Audit Trail)

> **เลื่อนไปเฟสถัดไป:** เวอร์ชันแรก **ไม่สร้างตาราง `audit_log` รวม** เพื่อประหยัดพื้นที่ฐานข้อมูล

ปัจจุบันอาศัยคอลัมน์บนแถวข้อมูลเป็นร่องรอยหลัก:
- ผู้ใช้: `role`, `is_blocked`, `blocked_at`, `blocked_by`
- การจอง: `created_at`, `canceled_at`, `canceled_by`, `canceled_reason`, `key_entered_by/at`, `key_returned_by/at`
- ห้อง / ประเภทห้อง: `created_at`, `deleted_at`, `deleted_by`
- บล็อกห้อง / ช่วงเวลาให้บริการ / วันหยุด: `created_by`, `created_at`

เหตุการณ์ที่อนาคตควรมีตาราง audit รวม: เปลี่ยน role/บล็อกผู้ใช้, override สถานะการจอง, ลบ/กู้คืนห้องและประเภทห้อง

---

## 13. ข้อกำหนดเชิงคุณภาพ (Non-functional)

- **ความถูกต้องภายใต้การทำงานพร้อมกัน:** การป้องกันจองซ้ำของห้อง `EXCLUSIVE` บังคับที่ระดับ DB (exclusion constraint) และการนับความจุของห้อง `CAPACITY` ใช้การล็อกต่อห้อง เพื่อกัน race condition
- **ความปลอดภัย:** เข้าถึง DB จาก server เท่านั้น (ไม่เปิด RLS ให้ client), จำกัดโดเมนอีเมล 2 ชั้น
- **ความถูกต้องของเวลา:** ขอบวัน/slot/วันหยุด คำนวณที่ Asia/Bangkok เท่านั้น ไม่พึ่ง timezone ของ server

---

## ภาคผนวก A — การออกแบบฐานข้อมูล (PostgreSQL)

### A.0 Extensions
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- รองรับ EXCLUDE ... USING gist บน uuid/varchar
-- ใช้ gen_random_uuid() (built-in PostgreSQL 13+) แทน uuid_generate_v4()
```

### A.1 Enums
```sql
CREATE TYPE user_role           AS ENUM ('user','admin');
CREATE TYPE reservation_status  AS ENUM ('PENDING','ACTIVE','COMPLETED','LATE_RETURN','CANCELLED','NO_SHOW');
CREATE TYPE booking_mode        AS ENUM ('EXCLUSIVE','CAPACITY');
-- หมายเหตุ: service_period.kind เก็บเป็น varchar + CHECK แทน enum
-- เพราะ exclusion constraint ต้องใช้ค่าใน index expression และ enum -> text ไม่ IMMUTABLE
```

### A.2 users
```sql
CREATE TABLE users (
  id            varchar(255) PRIMARY KEY,            -- = Supabase auth uid
  email         varchar(255) NOT NULL UNIQUE,
  full_name     varchar(255),
  image_url     varchar(255),
  role          user_role    NOT NULL DEFAULT 'user',
  is_blocked    boolean      NOT NULL DEFAULT false,
  blocked_at    timestamptz,
  blocked_by    varchar(255) REFERENCES users(id),
  last_login_at timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT users_email_ku CHECK (lower(email) LIKE '%@ku.th')
);
```

### A.3 room_type
```sql
CREATE TABLE room_type (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 varchar(1) NOT NULL,          -- S / G / P
  type_name            varchar(100) NOT NULL,
  booking_mode         booking_mode NOT NULL,
  min_duration_minutes integer NOT NULL DEFAULT 60 CHECK (min_duration_minutes > 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  deleted_by           varchar(255) REFERENCES users(id)
);
CREATE UNIQUE INDEX room_type_code_unique ON room_type (code)      WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX room_type_name_unique ON room_type (type_name) WHERE deleted_at IS NULL;

-- ห้าม soft delete ประเภทห้องที่ยังมีห้องใช้งาน (บังคับระดับ DB)
CREATE OR REPLACE FUNCTION room_type_guard_delete() RETURNS trigger AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
     AND EXISTS (SELECT 1 FROM rooms WHERE room_type_id = NEW.id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'room_type % still has active rooms', NEW.id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER room_type_guard_delete
BEFORE UPDATE OF deleted_at ON room_type
FOR EACH ROW EXECUTE FUNCTION room_type_guard_delete();
```

### A.4 rooms
```sql
CREATE TABLE rooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid NOT NULL REFERENCES room_type(id),
  name         varchar(100) NOT NULL,
  max_capacity integer CHECK (max_capacity IS NULL OR max_capacity > 0),  -- บังคับเมื่อ booking_mode = CAPACITY (ตรวจฝั่ง app)
  facilities   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   varchar(255) REFERENCES users(id)
);
CREATE UNIQUE INDEX rooms_name_unique ON rooms (name) WHERE deleted_at IS NULL;
```

### A.5 reservation
```sql
CREATE TABLE reservation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         varchar(255) NOT NULL REFERENCES users(id),
  room_id         uuid NOT NULL REFERENCES rooms(id),
  booking_mode    booking_mode NOT NULL,   -- denormalized จาก room_type (trigger เซ็ต)
  booking_date    date NOT NULL,           -- (start_time AT TIME ZONE 'Asia/Bangkok')::date (trigger เซ็ต)
  booking_code    varchar(6) NOT NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  status          reservation_status NOT NULL DEFAULT 'PENDING',
  key_entered_at  timestamptz,
  key_entered_by  varchar(255) REFERENCES users(id),
  key_returned_at timestamptz,
  key_returned_by varchar(255) REFERENCES users(id),
  canceled_at     timestamptz,
  canceled_by     varchar(255) REFERENCES users(id),
  canceled_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reservation_time_validity CHECK (end_time > start_time),
  CONSTRAINT reservation_code_digits   CHECK (booking_code ~ '^[0-9]{6}$'),

  -- G/P: ห้ามจองทับในห้องเดียวกัน (เฉพาะสถานะที่ครองช่วง)
  CONSTRAINT reservation_room_exclusive EXCLUDE USING gist (
      room_id WITH =,
      tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (booking_mode = 'EXCLUSIVE' AND status IN ('PENDING','ACTIVE')),

  -- ผู้ใช้คนเดียวห้ามจองทับตัวเอง (ทุกประเภท)
  CONSTRAINT reservation_user_no_overlap EXCLUDE USING gist (
      user_id WITH =,
      tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('PENDING','ACTIVE'))
);

-- รหัส 6 หลัก: ซ้ำได้ข้ามวัน แต่ห้ามซ้ำในวันเดียวกัน
CREATE UNIQUE INDEX reservation_code_per_day ON reservation (booking_code, booking_date);

CREATE INDEX reservation_room_range_idx   ON reservation USING gist (room_id, tstzrange(start_time, end_time, '[)'));
CREATE INDEX reservation_user_time_idx    ON reservation (user_id, start_time);
CREATE INDEX reservation_status_start_idx ON reservation (status, start_time);   -- ให้ pg_cron หา NO_SHOW
CREATE INDEX reservation_booking_date_idx ON reservation (booking_date);
```

**Trigger เซ็ตค่าที่ derive ได้ (กัน spoof + เลี่ยงข้อจำกัด IMMUTABLE ของ `AT TIME ZONE`)**
```sql
CREATE OR REPLACE FUNCTION reservation_set_derived() RETURNS trigger AS $$
BEGIN
  SELECT rt.booking_mode INTO NEW.booking_mode
  FROM rooms r JOIN room_type rt ON rt.id = r.room_type_id
  WHERE r.id = NEW.room_id;

  NEW.booking_date := (NEW.start_time AT TIME ZONE 'Asia/Bangkok')::date;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_set_derived
BEFORE INSERT OR UPDATE OF room_id, start_time ON reservation
FOR EACH ROW EXECUTE FUNCTION reservation_set_derived();
```

**การจองห้อง S (CAPACITY) — ล็อกแล้วนับก่อน insert**
```sql
SELECT pg_advisory_xact_lock(hashtextextended($room_id::text, 0));

SELECT count(*) FROM reservation
 WHERE room_id = $room_id
   AND status IN ('PENDING','ACTIVE')
   AND tstzrange(start_time, end_time, '[)') && tstzrange($start, $end, '[)');
-- ถ้า count < rooms.max_capacity จึง insert (ห้อง EXCLUSIVE ปล่อยให้ exclusion constraint กันเอง)
```

### A.6 service_period
```sql
CREATE TABLE service_period (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           varchar(100) NOT NULL,
  kind           varchar(16) NOT NULL,      -- 'NORMAL' / 'EXAM' (เก็บเป็น varchar เพราะ exclusion ต้องใช้ค่าใน index)
  open_time      time NOT NULL,
  close_time     time NOT NULL,
  effective_from date NOT NULL,
  effective_to   date,                      -- NULL = เปิดต่อไปเรื่อย ๆ
  created_by     varchar(255) NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_period_kind_valid    CHECK (kind IN ('NORMAL','EXAM')),
  CONSTRAINT service_period_time_validity  CHECK (close_time > open_time),
  CONSTRAINT service_period_range_validity CHECK (effective_to IS NULL OR effective_to >= effective_from),
  -- NORMAL ห้ามทับ NORMAL, EXAM ห้ามทับ EXAM แต่ EXAM ทับ NORMAL ได้
  CONSTRAINT service_period_no_overlap EXCLUDE USING gist (
      kind WITH =,
      daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  )
);
```

### A.7 holiday
```sql
CREATE TABLE holiday (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name         varchar(200) NOT NULL,
  note         text,
  created_by   varchar(255) NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX holiday_date_unique ON holiday (holiday_date);
```

### A.8 room_block
```sql
CREATE TABLE room_block (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id),
  start_time timestamptz NOT NULL,
  end_time   timestamptz NOT NULL,
  reason     text NOT NULL,
  created_by varchar(255) NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_block_time_validity CHECK (end_time > start_time),
  CONSTRAINT room_block_no_overlap EXCLUDE USING gist (
      room_id WITH =,
      tstzrange(start_time, end_time, '[)') WITH &&
  )
);
```

### A.9 notification_outbox — ยกเลิกแล้ว
**ปรับปรุง: 2026-10-26 (#24)** — ตาราง `notification_outbox`, enum `outbox_status`
และ index `outbox_pending_idx` ถูก **ลบ** ด้วย migration `drizzle/0004_drop_notification_outbox.sql`
(พร้อม unschedule job `notification-outbox-dispatch`) ระบบส่งอีเมลทันทีผ่าน SMTP แทน — ดูข้อ 11

### A.10 Audit Log — เลื่อนไปเฟสถัดไป
เวอร์ชันแรก **ไม่สร้างตาราง `audit_log`** เพื่อประหยัดพื้นที่ ใช้คอลัมน์ร่องรอยบนแถวข้อมูลแทน (ดูข้อ 12)
เมื่อมีความจำเป็น สามารถเพิ่มภายหลังได้โดยไม่กระทบ schema เดิม

### A.11 Seed ประเภทห้อง
```sql
INSERT INTO room_type (code, type_name, booking_mode, min_duration_minutes) VALUES
  ('S','ห้องทั่วไป',    'CAPACITY', 60),
  ('G','ห้องประชุมใหญ่','EXCLUSIVE',120),
  ('P','ห้องละหมาด',    'EXCLUSIVE',60);
```

### A.12 หมายเหตุการทำงานร่วมกับ Drizzle ORM
- `EXCLUDE ... WHERE`, `tstzrange(...)`, trigger และ `CREATE EXTENSION` **ประกาศใน `schema.ts` ไม่ได้** ต้อง generate migration แล้วแก้ไฟล์ SQL เอง หรือใช้ custom migration แยก
- คอลัมน์ `booking_mode` และ `booking_date` เป็นค่าที่ trigger เซ็ต — app ไม่ต้องเชื่อค่าที่ส่งมา (trigger เขียนทับทุกครั้ง)
- การตรวจ weekend / holiday / service window / ระยะเวลาขั้นต่ำ / ขอบเขต slot / จำนวนบล็อก เป็นหน้าที่ชั้น server (สามารถเสริมเป็น BEFORE trigger `reservation_guard()` ภายหลังได้)
- **Soft delete** จำกัดเฉพาะ `rooms` และ `room_type`; การกู้คืนให้ **reuse แถวเดิม** (ลอง insert → ถ้าชน unique ให้ update แถวที่ถูกลบให้ `deleted_at = NULL`) เพื่อรักษา FK
- **`room_type` ที่ยังมีห้องใช้งานอยู่ห้ามลบ** — บังคับด้วย trigger `room_type_guard_delete`

---

## ภาคผนวก B — ประเด็นที่ยังต้องตัดสินก่อน/ระหว่างพัฒนา

1. ค่าเริ่มต้น `service_period` (NORMAL 08:30–16:30) ต้อง seed หลังสร้างแอดมินคนแรก และแนวทางนำเข้าข้อมูล `holiday`
2. ✅ ตัดสินแล้วใน #14 และ **ปรับปรุงใน #24** — รูปแบบ/ภาษา/หัวข้ออีเมลรหัสการจองและแจ้งยกเลิก
   ใช้การส่งทันทีแบบ best-effort; **ยกเลิกนโยบาย retry ของ outbox** (ไม่มีคิว/ตาราง outbox แล้ว)
3. ตารางเวลา `pg_cron` ที่แน่นอน (NO_SHOW, การส่งอีเมล)
   - **✅ NO_SHOW (ตั๋ว #13):** job `reservation-no-show` รัน **ทุกนาที** (`* * * * *`)
     เรียก `mark_no_show_reservations()` ตั้งเฉพาะ `PENDING` ที่ `start_time + 30 นาที <= now()`
     เป็น `NO_SHOW`
   - **✅ การส่งอีเมล (ตั๋ว #14, ปรับปรุง #24):** **ไม่มี pg_cron job สำหรับอีเมลแล้ว**
     ระบบส่งทันทีผ่าน SMTP ใน request path หลัง DB commit; job `notification-outbox-dispatch`
     ถูก unschedule ใน migration `0004_drop_notification_outbox.sql`
   - รายละเอียด/เหตุผล/การตรวจสอบของ job ที่เหลือ (`reservation-no-show`) อยู่ที่
     [`docs/pg-cron-schedules.md`](docs/pg-cron-schedules.md)
5. UI การเลือกทีละบล็อก + การแสดงจำนวนครั้งที่ต้องยืนยัน ก่อนกดยืนยันการจอง
5. จะเพิ่ม `reservation_guard()` เป็น BEFORE trigger ฝั่ง DB ด้วยหรือพึ่งชั้น server อย่างเดียว
6. การบังคับ `max_capacity` ให้ไม่เป็น NULL เมื่อประเภทห้องเป็น `CAPACITY`
7. กรณีเปลี่ยน `booking_mode` ของประเภทห้องที่มีข้อมูลการจองอยู่แล้ว (ต้องกัน overlaps ที่ค้าง)
8. กลยุทธ์การทดสอบ: การแย่งกันของ exclusion/capacity, ขอบวัน Asia/Bangkok, การชนของรหัส, การ restore
