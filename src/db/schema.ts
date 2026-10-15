import { sql } from "drizzle-orm";
import {
    pgEnum,
    pgTable,
    uuid,
    varchar,
    timestamp,
    integer,
    text,
    uniqueIndex,
    check,
} from "drizzle-orm/pg-core";

// ============================================
// 1. Enums
// ============================================

export const userRoleEnum = pgEnum("user_role", [
    "user",
    "admin",
]);

export const reservationStatusEnum = pgEnum("reservation_status", [
    "PENDING",
    "ACTIVE",
    "COMPLETED",
    "LATE_RETURN",
    "CANCELLED",
    "NO_SHOW",
]);

// ============================================
// 2. Users
// ============================================

export const users = pgTable("users", {
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

    createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "date",
    })
        .notNull()
        .defaultNow(),
});

// ============================================
// 3. Room Types
// ============================================

export const roomType = pgTable(
    "room_type",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuid_generate_v4()`),

        typeName: varchar("type_name", { length: 100 })
            .notNull(),

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
        // ชื่อประเภทห้ามซ้ำ เฉพาะรายการที่ยังไม่ถูกลบ
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
            .default(sql`uuid_generate_v4()`),

        roomTypeId: uuid("room_type_id")
            .notNull()
            .references(() => roomType.id),

        name: varchar("name", { length: 100 })
            .notNull(),

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
        // ชื่อห้องห้ามซ้ำ เฉพาะรายการที่ยังไม่ถูกลบ
        uniqueIndex("rooms_name_unique")
            .on(table.name)
            .where(sql`${table.deletedAt} IS NULL`),
    ],
);

// ============================================
// 5. Reservations
// ============================================

export const reservation = pgTable(
    "reservation",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuid_generate_v4()`),

        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => users.id),

        roomId: uuid("room_id")
            .notNull()
            .references(() => rooms.id),

        bookingCode: varchar("booking_code", { length: 10 })
            .notNull()
            .unique(),

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

        enteredAt: timestamp("entered_at", {
            withTimezone: true,
            mode: "date",
        }),

        returnedAt: timestamp("returned_at", {
            withTimezone: true,
            mode: "date",
        }),

        keyEnteredBy: varchar("key_entered_by", { length: 255 })
            .references(() => users.id),

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
            "check_time_validity",
            sql`${table.endTime} > ${table.startTime}`,
        ),
    ],
);

// ============================================
// 6. Room Blocks
// ============================================

export const roomBlock = pgTable(
    "room_block",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuid_generate_v4()`),

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

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),

        createdBy: varchar("created_by", { length: 255 })
            .notNull()
            .references(() => users.id),

        deletedAt: timestamp("deleted_at", {
            withTimezone: true,
            mode: "date",
        }),

        deletedBy: varchar("deleted_by", { length: 255 })
            .references(() => users.id),
    },
    (table) => [
        // เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น
        check(
            "check_block_time_validity",
            sql`${table.endTime} > ${table.startTime}`,
        ),
    ],
);

// ============================================
// 7. Inferred TypeScript Types
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type RoomType = typeof roomType.$inferSelect;
export type NewRoomType = typeof roomType.$inferInsert;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type Reservation = typeof reservation.$inferSelect;
export type NewReservation = typeof reservation.$inferInsert;

export type RoomBlock = typeof roomBlock.$inferSelect;
export type NewRoomBlock = typeof roomBlock.$inferInsert;