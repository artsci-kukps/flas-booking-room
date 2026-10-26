# ระบบจองห้องทำงาน (FLAS Booking Room)

ระบบจองห้องทำงานสำหรับบุคลากรมหาวิทยาลัยเกษตรศาสตร์ — เข้าสู่ระบบด้วย Google
(จำกัดเฉพาะอีเมล `@ku.th`) พร้อมระบบบทบาท `user` / `admin` และการระงับบัญชี

## เทคโนโลยี

- **Next.js 16** (App Router, `cacheComponents`, `partialPrefetching`) + React 19
- **Supabase** (Auth ผ่าน OAuth) + `@supabase/ssr`
- **PostgreSQL** + Drizzle ORM
- **Vitest** สำหรับเทสต์

## เริ่มต้นใช้งาน

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า environment

คัดลอก `.env.example` (ถ้ามี) หรือสร้างไฟล์ `.env` ที่รากโปรเจกต์ โดยมีค่าอย่างน้อย:

```dotenv
# การเชื่อมต่อฐานข้อมูล (ใช้กับ Drizzle)
DATABASE_URL_DIRECT=postgresql://...
DATABASE_URL=postgresql://...

# Supabase (Auth)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# อีเมลผ่าน SMTP (nodemailer) — ส่งทันทีทั้ง OTP/รหัสการจอง/แจ้งยกเลิก
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
SMTP_FROM=Creative Space <booking@ku.th>
```

### 3. เตรียมฐานข้อมูล

รัน migration ในโฟลเดอร์ `drizzle/` กับฐานข้อมูลเป้าหมายตามลำดับ:

```bash
npx drizzle-kit migrate
```

หรือรันไฟล์ SQL ใน `drizzle/` ทีละไฟล์ด้วยมือ (เช่นผ่าน Supabase SQL editor)
โดยเรียงตามเลข `0000` → `0004`

### 4. รัน development server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## คำสั่งที่ใช้บ่อย

| คำสั่ง | คำอธิบาย |
| --- | --- |
| `npm run dev` | เริ่ม dev server |
| `npm run build` | build สำหรับ production |
| `npm run start` | รัน production build |
| `npm test` | รันเทสต์ทั้งหมดด้วย Vitest |
| `npm run lint` | ตรวจ code style ด้วย ESLint |

## การทดสอบ (Vitest)

Vitest แบ่งเป็น 2 โปรเจกต์ (ดู `vitest.config.mts`)

| โปรเจกต์ | environment | ไฟล์ที่รับ | ใช้ทำอะไร |
| --- | --- | --- | --- |
| `node` (ค่าเริ่มต้น) | `node` | `src/**/*.test.{ts,tsx}` (ยกเว้น `*.dom.test.tsx`) | ทดสอบตรรกะ/ฟังก์ชันฝั่ง server |
| `dom` | `jsdom` | `src/**/*.dom.test.tsx` | ทดสอบ client component แบบโต้ตอบได้ (คลิก/พิมพ์/ส่งฟอร์ม) ด้วย `@testing-library/react` |

- ไฟล์ทดสอบ DOM ต้องตั้งชื่อลงท้ายด้วย `.dom.test.tsx` เท่านั้น เช่น `src/components/booking/room-time-grid.dom.test.tsx`
- โปรเจกต์ `dom` มี setup file ที่ `src/test/dom-setup.ts` (cleanup ของ RTL + matcher ของ `@testing-library/jest-dom` + แผ่นข้างต้น `HTMLDialogElement.showModal()` ที่ jsdom ยังไม่ทำ)
- ถ้าต้องการสภาพแวดล้อมอื่นในไฟล์เดียว ใส่ docblock `// @vitest-environment jsdom` (หรือ `node`) ไว้บนสุดไฟล์ได้

## การควบคุมการเข้าถึง (Auth guards)

- `src/lib/auth/guards.ts` — helper กลางสำหรับทุกเส้นทาง
  - `getCurrentUser()` อ่าน session จาก Supabase แล้วโหลดแถว `users` ที่ตรงกัน
  - `requireUser()` ไม่มี session → `/login`, ถูกบล็อก → `/blocked`
  - `requireAdmin()` ผู้ที่ไม่ใช่แอดมิน → `forbidden()` (HTTP 403)
- หน้าในแอปทั้งหมดอยู่ใน route group `src/app/(protected)/` ซึ่ง layout เรียก
  `requireUser()` ให้อัตโนมัติ (secure by default) — เพิ่มหน้าใหม่ในกลุ่มนี้เพื่อให้ถูกป้องกันทันที
- เส้นทางแอดมินอยู่ใต้ `src/app/(protected)/admin/` และเรียก `requireAdmin()`
- `src/proxy.ts` เป็นเพียงการ redirect แบบ optimistic (ยังไม่มี session → `/login`)
  การตรวจสิทธิ์จริงเกิดขึ้นที่ guard ใน route เสมอ
- UI ของ 403 อยู่ที่ `src/app/forbidden.tsx` (เปิดใช้ผ่าน `experimental.authInterrupts`)
  และหน้าแจ้งผู้ใช้ที่ถูกระงับอยู่ที่ `src/app/blocked/page.tsx`

## สร้างแอดมินคนแรก (Seed)

แอดมินคนแรก **สร้างผ่าน UI ไม่ได้** (ผู้ใช้ทุกคนเริ่มที่ `role = 'user'`)
ต้องเลื่อนขั้นผ่านฐานข้อมูลโดยตรงตามขั้นตอนนี้:

1. **ให้ผู้ที่จะเป็นแอดมินเข้าสู่ระบบก่อน 1 ครั้ง** ด้วยบัญชี `@ku.th`
   เพื่อให้ระบบสร้างแถวในตาราง `users` (คีย์ตรงกับ Supabase auth uid)
2. **รันสคริปต์เลื่อนขั้น** โดยระบุอีเมล (ต้องมี `DATABASE_URL_DIRECT` ใน `.env`):

   ```bash
   npm run seed:admin -- --email someone@ku.th
   ```

   หรือใช้ environment variable:

   ```bash
   SEED_ADMIN_EMAIL=someone@ku.th npm run seed:admin
   ```

   สคริปต์เป็นแบบ idempotent — รันซ้ำได้ผลเท่าเดิม ถ้าไม่พบผู้ใช้อีเมลนั้น
   จะแจ้งเตือนและจบด้วย exit code 1 (แปลว่ายังไม่เคยเข้าสู่ระบบ)
3. **ทดลองก่อนโดยไม่เขียนฐานข้อมูล** ได้ด้วย `--dry-run`:

   ```bash
   npm run seed:admin -- --email someone@ku.th --dry-run
   ```

4. ตรวจสอบผลโดยให้ผู้ใช้นั้นเข้าสู่ระบบใหม่ แล้วเปิด `/admin` (ควรเข้าถึงได้)

> หมายเหตุ: สคริปต์อ่านการเชื่อมต่อจาก `DATABASE_URL_DIRECT` ผ่าน `src/db/index.ts`
> และไม่ต้องรัน migration เพิ่มสำหรับการ seed

## เอกสารอ้างอิง

- ข้อกำหนดระบบ: [`TOR.md`](./TOR.md)
- โครงสร้างฐานข้อมูล: [`SCHEMA_DOCS.md`](./SCHEMA_DOCS.md)
