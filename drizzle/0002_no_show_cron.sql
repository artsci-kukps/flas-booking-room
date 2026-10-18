-- ============================================================
-- 0002: pg_cron ตั้งสถานะ NO_SHOW อัตโนมัติ (TOR ข้อ 7, A.5, ภาคผนวก B.3)
--
--   "ถ้ายังเป็น PENDING และเวลาผ่านไปเกิน start_time + 30 นาที → NO_SHOW"
--
-- กติกา:
--   1) แตะเฉพาะแถวที่ status = 'PENDING' เท่านั้น (ACTIVE / COMPLETED /
--      LATE_RETURN / CANCELLED / NO_SHOW ไม่ถูกแตะโดยเด็ดขาด)
--   2) เกณฑ์เป็น instant: start_time + interval '30 minutes' <= now()
--      ไม่ผูก timezone ของเซิร์ฟเวอร์ และไม่ใช้ปฏิทินวัน (ข้ามเที่ยงคืน Bangkok ได้)
--   3) เมื่อเป็น NO_SHOW แล้ว ช่องว่างถูกปล่อยทันที เพราะ exclusion constraint
--      reservation_room_exclusive / reservation_user_no_overlap คิดเฉพาะ PENDING/ACTIVE
--   4) ตารางเวลา: ทุกนาที (ดู docs/pg-cron-schedules.md)
--      pg_cron ตีความ cron expression เป็น UTC เสมอ — เลือกความถี่ระดับนาที
--      (ไม่ใช่วันละครั้ง/ตามชั่วโมง) ตารางจึงไม่ขึ้นกับ timezone
-- ============================================================

-- pg_cron: บน Supabase เปิดไว้แล้ว; คำสั่งนี้กันกรณี Postgres เปล่า/สภาพแวดล้อมอื่น
CREATE EXTENSION IF NOT EXISTS pg_cron;--> statement-breakpoint

-- ฟังก์ชันรวมกฎ NO_SHOW (Drizzle ORM ประกาศใน schema.ts ไม่ได้ — TOR A.12)
-- คืนจำนวนแถวที่ถูกเปลี่ยน เพื่อดูผลใน cron.job_run_details ได้
CREATE OR REPLACE FUNCTION "mark_no_show_reservations"() RETURNS integer AS $$
DECLARE
    affected integer;
BEGIN
    UPDATE "reservation"
       SET "status" = 'NO_SHOW'
     WHERE "status" = 'PENDING'
       AND "start_time" + interval '30 minutes' <= now();
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- เลือก job ที่ชื่อเดิมออกก่อน (กันซ้ำเมื่อรัน migration ซ้ำ/มี job ค้าง)
SELECT cron.unschedule('reservation-no-show')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reservation-no-show');--> statement-breakpoint

-- ตารางเวลา: ทุกนาที ทุกวัน — ปล่อยช่องว่างเร็วสุดภายใน ~1 นาทีหลังครบ 30 นาที
SELECT cron.schedule(
    'reservation-no-show',
    '* * * * *',
    $$SELECT "mark_no_show_reservations"();$$
);--> statement-breakpoint
