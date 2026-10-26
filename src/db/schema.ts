import { sql } from "drizzle-orm";
import {
    pgEnum,
    pgTable,
    uuid,
    varchar,
    timestamp,
    integer,
    text,
    boolean,
    date,
    time,
    uniqueIndex,
    index,
    check,
    type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ============================================
// 0. หมายเหตุสำคัญ
// ============================================
// Drizzle ไม่สามารถประกาศสิ่งต่อไปนี้ใน schema ได้ ต้องเขียนใน migration SQL เอง
// (ดู drizzle/xxxx_custom_rules.sql):
//   - CREATE EXTENSION btree_gist
//   - EXCLUDE USING gist (exclusion constraints) ทุกตัว
//   - index ที่ใช้ tstzrange()/gist บนช่วงเวลา
//   - trigger reservation_set_derived() (เซ็ต booking_mode + booking_date)
//   - trigger room_type_guard_delete() (ห้ามลบ room_type ที่ยังมีห้องใช้งาน)
//   - ในไฟล์นี้มี comment กำกับทุกจุด (ดู "RAW SQL:")

// ============================================
// 1. Enums
// ============================================

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const reservationStatusEnum = pgEnum("reservation_status", [
    "PENDING",
    "ACTIVE",
    "COMPLETED",
    "LATE_RETURN",
    "CANCELLED",
    "NO_SHOW",
]);

// โหมดการจองของประเภทห้อง
//   EXCLUSIVE = ห้ามจองทับ (G, P)
//   CAPACITY  = จองทับได้จนครบความจุ (S)
export const bookingModeEnum = pgEnum("booking_mode", [
    "EXCLUSIVE",
    "CAPACITY",
]);

// ประเภทช่วงเวลาเปิดทำการ: NORMAL = ปกติ, EXAM = ช่วงสอบ
// เก็บเป็น varchar + CHECK (ไม่ใช่ pgEnum) เพราะ exclusion constraint
// ต้องใช้ค่านี้ใน index expression ได้ แต่การ cast enum -> text ไม่ IMMUTABLE
export const servicePeriodKindValues = ["NORMAL", "EXAM"] as const;
export type ServicePeriodKind = (typeof servicePeriodKindValues)[number];

// ============================================
// 2. Users
// ============================================
// ห้ามลบผู้ใช้ (ไม่มี deleted_at) เพื่อคงความถูกต้องของประวัติการจอง
// การบล็อกผู้ใช้ใช้ is_blocked / blocked_at / blocked_by

export const users = pgTable(
    "users",
    {
        id: varchar("id", { length: 255 })
            .primaryKey(),

        email: varchar("email", { length: 255 })
            .notNull()
            .unique(),
        fullName: varchar("full_name", { length: 255 }),
        imageUrl: varchar("image_url", { length: 255 }),

        role: userRoleEnum("role")
            .notNull()
            .default("user"),

        isBlocked: boolean("is_blocked")
            .notNull()
            .default(false),
        blockedAt: timestamp("blocked_at", {
            withTimezone: true,
            mode: "date",
        }),
        blockedBy: varchar("blocked_by", { length: 255 })
            .references((): AnyPgColumn => users.id),

        lastLoginAt: timestamp("last_login_at", {
            withTimezone: true,
            mode: "date",
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        // อนุญาตเฉพาะอีเมล @ku.th (ด่านสุดท้ายฝั่ง DB)
        check(
            "users_email_ku",
            sql`lower(${table.email}) LIKE '%@ku.th'`,
        ),
    ],
);

// ============================================
// 3. Room Types
// ============================================

export const roomType = pgTable(
    "room_type",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`gen_random_uuid()`),

        // รหัสประเภท: S / G / P
        code: varchar("code", { length: 1 })
            .notNull(),

        typeName: varchar("type_name", { length: 100 })
            .notNull(),

        // กติกาการจองของประเภทนี้
        bookingMode: bookingModeEnum("booking_mode")
            .notNull(),

        minDurationMinutes: integer("min_duration_minutes")
            .notNull()
            .default(60),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),

        deletedAt: timestamp("deleted_at", {
            withTimezone: true,
            mode: "date",
        }),

        deletedBy: varchar("deleted_by", { length: 255 })
            .references(() => users.id),
    },
    (table) => [
        check(
            "room_type_min_duration_positive",
            sql`${table.minDurationMinutes} > 0`,
        ),

        // รหัส/ชื่อประเภทห้ามซ้ำ เฉพาะรายการที่ยังไม่ถูกลบ
        uniqueIndex("room_type_code_unique")
            .on(table.code)
            .where(sql`${table.deletedAt} IS NULL`),
        uniqueIndex("room_type_name_unique")
            .on(table.typeName)
            .where(sql`${table.deletedAt} IS NULL`),
    ],
);

// ============================================
// 4. Rooms
// ============================================

export const rooms = pgTable(
    "rooms",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`gen_random_uuid()`),

        roomTypeId: uuid("room_type_id")
            .notNull()
            .references(() => roomType.id),

        name: varchar("name", { length: 100 })
            .notNull(),

        // บังคับให้มีค่าเมื่อประเภทห้องเป็น CAPACITY (ตรวจฝั่ง app / trigger)
        maxCapacity: integer("max_capacity"),

        facilities: text("facilities"),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),

        deletedAt: timestamp("deleted_at", {
            withTimezone: true,
            mode: "date",
        }),

        deletedBy: varchar("deleted_by", { length: 255 })
            .references(() => users.id),
    },
    (table) => [
        check(
            "rooms_max_capacity_positive",
            sql`${table.maxCapacity} IS NULL OR ${table.maxCapacity} > 0`,
        ),

        // ชื่อห้องห้ามซ้ำ เฉพาะรายการที่ยังไม่ถูกลบ
        uniqueIndex("rooms_name_unique")
            .on(table.name)
            .where(sql`${table.deletedAt} IS NULL`),
    ],
);

// ============================================
// 5. Reservations
// ============================================
// RAW SQL: (เขียนใน migration)
//   btree_gist extension
//   CONSTRAINT reservation_room_exclusive EXCLUDE USING gist (room_id WITH =, tstzrange(...) WITH &&)
//              WHERE status IN ('PENDING','ACTIVE') AND booking_mode = 'EXCLUSIVE'
//   CONSTRAINT reservation_user_no_overlap EXCLUDE USING gist (user_id WITH =, tstzrange(...) WITH &&)
//              WHERE status IN ('PENDING','ACTIVE')
//   INDEX reservation_room_range_idx USING gist (room_id, tstzrange(start_time, end_time, '[)'))
//   TRIGGER reservation_set_derived -> เซ็ต booking_mode + booking_date

export const reservation = pgTable(
    "reservation",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`gen_random_uuid()`),

        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => users.id),

        roomId: uuid("room_id")
            .notNull()
            .references(() => rooms.id),

        // denormalized จาก room_type (trigger เซ็ต — app ไม่ต้องเชื่อค่าที่ส่งมา)
        bookingMode: bookingModeEnum("booking_mode")
            .notNull(),

        // (start_time AT TIME ZONE 'Asia/Bangkok')::date (trigger เซ็ต)
        bookingDate: date("booking_date")
            .notNull(),

        bookingCode: varchar("booking_code", { length: 6 })
            .notNull(),

        startTime: timestamp("start_time", {
            withTimezone: true,
            mode: "date",
        }).notNull(),

        endTime: timestamp("end_time", {
            withTimezone: true,
            mode: "date",
        }).notNull(),

        status: reservationStatusEnum("status")
            .notNull()
            .default("PENDING"),

        keyEnteredAt: timestamp("key_entered_at", {
            withTimezone: true,
            mode: "date",
        }),
        keyEnteredBy: varchar("key_entered_by", { length: 255 })
            .references(() => users.id),

        keyReturnedAt: timestamp("key_returned_at", {
            withTimezone: true,
            mode: "date",
        }),
        keyReturnedBy: varchar("key_returned_by", { length: 255 })
            .references(() => users.id),

        canceledAt: timestamp("canceled_at", {
            withTimezone: true,
            mode: "date",
        }),
        canceledBy: varchar("canceled_by", { length: 255 })
            .references(() => users.id),
        canceledReason: text("canceled_reason"),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        // เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น
        check(
            "reservation_time_validity",
            sql`${table.endTime} > ${table.startTime}`,
        ),

        // รหัสการจองต้องเป็นตัวเลข 6 หลัก
        check(
            "reservation_code_digits",
            sql`${table.bookingCode} ~ '^[0-9]{6}$'`,
        ),

        // รหัสห้ามซ้ำเฉพาะการจองในวันเดียวกัน (ซ้ำข้ามวันได้)
        uniqueIndex("reservation_code_per_day")
            .on(table.bookingCode, table.bookingDate),

        // ให้ pg_cron หา NO_SHOW และ query ประวัติ
        index("reservation_status_start_idx")
            .on(table.status, table.startTime),
        index("reservation_user_time_idx")
            .on(table.userId, table.startTime),
        index("reservation_booking_date_idx")
            .on(table.bookingDate),
    ],
);

// ============================================
// 6. Service Periods (เวลาเปิด–ปิด / ช่วงสอบ)
// ============================================
// RAW SQL: CONSTRAINT service_period_no_overlap EXCLUDE USING gist
//   (kind WITH =, daterange(effective_from, COALESCE(effective_to,'infinity'), '[]') WITH &&)
//   (ไม่มี soft delete — ลบจริง)

export const servicePeriod = pgTable(
    "service_period",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`gen_random_uuid()`),

        name: varchar("name", { length: 100 })
            .notNull(),

        kind: varchar("kind", {
            length: 16,
            enum: servicePeriodKindValues,
        })
            .notNull(),

        openTime: time("open_time").notNull(),
        closeTime: time("close_time").notNull(),

        effectiveFrom: date("effective_from").notNull(),
        // NULL = เปิดต่อไปเรื่อย ๆ
        effectiveTo: date("effective_to"),

        createdBy: varchar("created_by", { length: 255 })
            .notNull()
            .references(() => users.id),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            "service_period_kind_valid",
            sql`${table.kind} IN ('NORMAL', 'EXAM')`,
        ),
        check(
            "service_period_time_validity",
            sql`${table.closeTime} > ${table.openTime}`,
        ),
        check(
            "service_period_range_validity",
            sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} >= ${table.effectiveFrom}`,
        ),
    ],
);

// ============================================
// 7. Holidays (วันหยุดระดับระบบ — ปิดทุกห้อง)
// ============================================

export const holiday = pgTable(
    "holiday",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`gen_random_uuid()`),

        holidayDate: date("holiday_date")
            .notNull(),

        name: varchar("name", { length: 200 })
            .notNull(),
        note: text("note"),

        createdBy: varchar("created_by", { length: 255 })
            .notNull()
            .references(() => users.id),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("holiday_date_unique")
            .on(table.holidayDate),
    ],
);

// ============================================
// 8. Room Blocks (บล็อกเฉพาะห้อง)
// ============================================
// RAW SQL: CONSTRAINT room_block_no_overlap EXCLUDE USING gist
//   (room_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
//   (ไม่มี soft delete — ลบจริง)

export const roomBlock = pgTable(
    "room_block",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`gen_random_uuid()`),

        roomId: uuid("room_id")
            .notNull()
            .references(() => rooms.id),

        startTime: timestamp("start_time", {
            withTimezone: true,
            mode: "date",
        }).notNull(),

        endTime: timestamp("end_time", {
            withTimezone: true,
            mode: "date",
        }).notNull(),

        reason: text("reason")
            .notNull(),

        createdBy: varchar("created_by", { length: 255 })
            .notNull()
            .references(() => users.id),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            "room_block_time_validity",
            sql`${table.endTime} > ${table.startTime}`,
        ),
    ],
);

// ============================================
// 9. Inferred TypeScript Types
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type RoomType = typeof roomType.$inferSelect;
export type NewRoomType = typeof roomType.$inferInsert;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type Reservation = typeof reservation.$inferSelect;
export type NewReservation = typeof reservation.$inferInsert;

export type ServicePeriod = typeof servicePeriod.$inferSelect;
export type NewServicePeriod = typeof servicePeriod.$inferInsert;

export type Holiday = typeof holiday.$inferSelect;
export type NewHoliday = typeof holiday.$inferInsert;

export type RoomBlock = typeof roomBlock.$inferSelect;
export type NewRoomBlock = typeof roomBlock.$inferInsert;
