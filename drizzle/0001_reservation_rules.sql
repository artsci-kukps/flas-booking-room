-- ============================================================
-- Custom rules ที่ Drizzle ORM ประกาศใน schema.ts ไม่ได้
--   1) extension btree_gist
--   2) exclusion constraints (กันการจอง/บล็อก/ช่วงเวลาทับซ้อน)
--   3) gist index สำหรับ query ช่วงเวลา (ความจุห้อง S)
--   4) trigger เซ็ต booking_mode + booking_date
--   5) trigger ห้ามลบ room_type ที่ยังมีห้องใช้งาน
--   6) seed ประเภทห้อง S / G / P
-- ============================================================

-- 1) btree_gist: จำเป็นสำหรับ EXCLUDE ... USING gist บน uuid / varchar
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

-- 2) reservation: ห้อง EXCLUSIVE (G, P) ห้ามจองทับกัน
--    นับเฉพาะสถานะที่ "ครองช่วงเวลา" (PENDING, ACTIVE)
ALTER TABLE "reservation"
    ADD CONSTRAINT "reservation_room_exclusive" EXCLUDE USING gist (
        "room_id" WITH =,
        tstzrange("start_time", "end_time", '[)') WITH &&
    ) WHERE ("booking_mode" = 'EXCLUSIVE' AND "status" IN ('PENDING', 'ACTIVE'));--> statement-breakpoint

-- 2) reservation: ผู้ใช้คนเดียวห้ามจองทับตัวเอง (ทุกประเภทห้อง)
ALTER TABLE "reservation"
    ADD CONSTRAINT "reservation_user_no_overlap" EXCLUDE USING gist (
        "user_id" WITH =,
        tstzrange("start_time", "end_time", '[)') WITH &&
    ) WHERE ("status" IN ('PENDING', 'ACTIVE'));--> statement-breakpoint

-- 3) gist index สำหรับ query ช่วงเวลา (นับความจุห้อง S / ปฏิทิน)
CREATE INDEX "reservation_room_range_idx"
    ON "reservation" USING gist ("room_id", tstzrange("start_time", "end_time", '[)'));--> statement-breakpoint

-- 2) room_block: ห้ามมีรายการบล็อกที่ทับซ้อนกันในห้องเดียวกัน (ลบจริง ไม่มี soft delete)
ALTER TABLE "room_block"
    ADD CONSTRAINT "room_block_no_overlap" EXCLUDE USING gist (
        "room_id" WITH =,
        tstzrange("start_time", "end_time", '[)') WITH &&
    );--> statement-breakpoint

-- 2) service_period: NORMAL ห้ามทับ NORMAL และ EXAM ห้ามทับ EXAM
--    (EXAM ทับ NORMAL ได้ เพราะเทียบด้วย kind WITH =)
ALTER TABLE "service_period"
    ADD CONSTRAINT "service_period_no_overlap" EXCLUDE USING gist (
        "kind" WITH =,
        daterange("effective_from", COALESCE("effective_to", 'infinity'::date), '[]') WITH &&
    );--> statement-breakpoint

-- 4) trigger เซ็ตค่าที่ derive ได้ (กัน spoof + เลี่ยงข้อจำกัด IMMUTABLE ของ AT TIME ZONE)
CREATE OR REPLACE FUNCTION "reservation_set_derived"() RETURNS trigger AS $$
BEGIN
    SELECT rt."booking_mode" INTO NEW."booking_mode"
    FROM "rooms" r
    JOIN "room_type" rt ON rt."id" = r."room_type_id"
    WHERE r."id" = NEW."room_id";

    NEW."booking_date" := (NEW."start_time" AT TIME ZONE 'Asia/Bangkok')::date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "reservation_set_derived"
    BEFORE INSERT OR UPDATE OF "room_id", "start_time" ON "reservation"
    FOR EACH ROW EXECUTE FUNCTION "reservation_set_derived"();--> statement-breakpoint

-- 5) ห้าม soft delete room_type ที่ยังมีห้องที่ใช้งานอยู่ (deleted_at IS NULL)
--    บังคับที่ระดับ DB กันการลบพลาดจากชั้น app
CREATE OR REPLACE FUNCTION "room_type_guard_delete"() RETURNS trigger AS $$
BEGIN
    IF NEW."deleted_at" IS NOT NULL AND OLD."deleted_at" IS NULL THEN
        IF EXISTS (
            SELECT 1 FROM "rooms"
            WHERE "room_type_id" = NEW."id" AND "deleted_at" IS NULL
        ) THEN
            RAISE EXCEPTION 'room_type % still has active rooms', NEW."id"
                USING ERRCODE = 'restrict_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "room_type_guard_delete"
    BEFORE UPDATE OF "deleted_at" ON "room_type"
    FOR EACH ROW EXECUTE FUNCTION "room_type_guard_delete"();--> statement-breakpoint

-- 6) seed ประเภทห้อง 3 ประเภท
INSERT INTO "room_type" ("code", "type_name", "booking_mode", "min_duration_minutes")
VALUES
    ('S', 'ห้องทั่วไป',     'CAPACITY',  60),
    ('G', 'ห้องประชุมใหญ่', 'EXCLUSIVE', 120),
    ('P', 'ห้องละหมาด',     'EXCLUSIVE', 60)
ON CONFLICT ("code") WHERE "deleted_at" IS NULL DO NOTHING;
