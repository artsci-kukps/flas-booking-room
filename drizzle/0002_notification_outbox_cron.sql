-- ============================================================
-- #14 notification_outbox — pg_cron + pg_net ยิง worker ส่งอีเมลผ่าน Resend
--
-- นโยบาย retry / รูปแบบอีเมล / ตารางเวลา: docs/notifications/outbox.md (ภาคผนวก B.2–B.3 ของ TOR)
--
-- ทำไมต้องมี worker ในแอป:
--   pg_cron ส่งอีเมล (HTTP ไป Resend) เองไม่ได้ — จึงให้ pg_cron เป็นตัว "ตั้งเวลา"
--   แล้วใช้ pg_net ยิง HTTP POST ไปที่ endpoint /api/cron/outbox ของแอป
--   ตัว worker จะหยิบรายการ PENDING ที่ next_attempt_at <= now() ไปส่ง แล้วอัปเดต
--   SENT / retry / FAILED ตามนโยบาย (index outbox_pending_idx รองรับ query นี้)
--
-- ตั้งค่าก่อนใช้งาน (ค่าเก็บเป็น GUC ของฐานข้อมูล/role ที่ pg_cron รัน):
--   ALTER DATABASE <db> SET app.outbox_url  = 'https://<app>/api/cron/outbox';
--   ALTER DATABASE <db> SET app.cron_secret = '<ค่าเดียวกับ CRON_SECRET ของแอป>';
-- ถ้ายังไม่ตั้ง app.outbox_url งานจะไม่ยิงอะไรเลย (กันด้วย WHERE ด้านล่าง)
-- ============================================================

-- pg_cron = ตัวจัดตารางเวลา, pg_net = ยิง HTTP ออกจากฐานข้อมูล
-- (บน Supabase ทั้งสองตัวมีให้เปิดใช้; ถ้าเปิดอยู่แล้ว IF NOT EXISTS จะไม่ทำอะไร)
CREATE EXTENSION IF NOT EXISTS pg_cron;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_net;--> statement-breakpoint

-- ยิง worker ทุก 1 นาที — ชื่อ job ซ้ำจะถูกแทนที่ (cron.schedule เป็น upsert ตามชื่อ)
SELECT cron.schedule(
    'notification-outbox-dispatch',
    '* * * * *',
    $cron$
    SELECT net.http_post(
        url     := current_setting('app.outbox_url', true),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(current_setting('app.cron_secret', true), '')
        ),
        body    := '{}'::jsonb
    )
    WHERE current_setting('app.outbox_url', true) IS NOT NULL;
    $cron$
);
