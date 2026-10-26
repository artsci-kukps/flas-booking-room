-- ============================================================
-- 0004: ยกเลิกคิวอีเมล notification_outbox
--
-- เปลี่ยนจาก "เข้าคิวแล้วให้ pg_cron ยิง worker มาส่ง" เป็น "ส่งทันทีผ่าน SMTP
-- (nodemailer) ใน request path" ตามการตัดสินใจใน #24 จึงเก็บกวาดกลไกเดิม:
--   1) unschedule job ของ outbox ก่อน — กัน pg_net ยิงเข้า route ที่ถูกลบแล้ว
--   2) drop ตาราง + enum (index และ FK ถูกลบตามตาราง)
--
-- สิ่งที่ "ไม่" ลบ: pg_cron / pg_net และ job `reservation-no-show`
-- (ฟังก์ชัน mark_no_show_reservations) เพราะเป็นงานคนละเรื่องกับการแจ้งเตือน
--
-- หมายเหตุ: 0002/0003 ถูก apply ด้วยมือก่อนหน้านี้และยังไม่มีบันทึกใน
-- drizzle.__drizzle_migrations — การรัน migrate ครั้งนี้จะบันทึกให้ด้วย
-- (ทั้งสองไฟล์เขียนแบบ idempotent จึงรันซ้ำได้ปลอดภัย)
-- ============================================================

SELECT cron.unschedule('notification-outbox-dispatch')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-outbox-dispatch');--> statement-breakpoint

DROP TABLE "notification_outbox" CASCADE;--> statement-breakpoint
DROP TYPE "public"."outbox_status";
