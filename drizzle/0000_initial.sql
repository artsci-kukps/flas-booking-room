CREATE TYPE "public"."booking_mode" AS ENUM('EXCLUSIVE', 'CAPACITY');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'LATE_RETURN', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "holiday" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holiday_date" date NOT NULL,
	"name" varchar(200) NOT NULL,
	"note" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"type" varchar(50) DEFAULT 'BOOKING_CODE' NOT NULL,
	"to_email" varchar(255) NOT NULL,
	"subject" text,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"room_id" uuid NOT NULL,
	"booking_mode" "booking_mode" NOT NULL,
	"booking_date" date NOT NULL,
	"booking_code" varchar(6) NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "reservation_status" DEFAULT 'PENDING' NOT NULL,
	"key_entered_at" timestamp with time zone,
	"key_entered_by" varchar(255),
	"key_returned_at" timestamp with time zone,
	"key_returned_by" varchar(255),
	"canceled_at" timestamp with time zone,
	"canceled_by" varchar(255),
	"canceled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_time_validity" CHECK ("reservation"."end_time" > "reservation"."start_time"),
	CONSTRAINT "reservation_code_digits" CHECK ("reservation"."booking_code" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "room_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_block_time_validity" CHECK ("room_block"."end_time" > "room_block"."start_time")
);
--> statement-breakpoint
CREATE TABLE "room_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(1) NOT NULL,
	"type_name" varchar(100) NOT NULL,
	"booking_mode" "booking_mode" NOT NULL,
	"min_duration_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "room_type_min_duration_positive" CHECK ("room_type"."min_duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"max_capacity" integer,
	"facilities" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "rooms_max_capacity_positive" CHECK ("rooms"."max_capacity" IS NULL OR "rooms"."max_capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "service_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"open_time" time NOT NULL,
	"close_time" time NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_period_kind_valid" CHECK ("service_period"."kind" IN ('NORMAL', 'EXAM')),
	CONSTRAINT "service_period_time_validity" CHECK ("service_period"."close_time" > "service_period"."open_time"),
	CONSTRAINT "service_period_range_validity" CHECK ("service_period"."effective_to" IS NULL OR "service_period"."effective_to" >= "service_period"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"image_url" varchar(255),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_at" timestamp with time zone,
	"blocked_by" varchar(255),
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_ku" CHECK (lower("users"."email") LIKE '%@ku.th')
);
--> statement-breakpoint
ALTER TABLE "holiday" ADD CONSTRAINT "holiday_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_key_entered_by_users_id_fk" FOREIGN KEY ("key_entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_key_returned_by_users_id_fk" FOREIGN KEY ("key_returned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_canceled_by_users_id_fk" FOREIGN KEY ("canceled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_block" ADD CONSTRAINT "room_block_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_block" ADD CONSTRAINT "room_block_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type" ADD CONSTRAINT "room_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_room_type_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_period" ADD CONSTRAINT "service_period_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "holiday_date_unique" ON "holiday" USING btree ("holiday_date");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_code_per_day" ON "reservation" USING btree ("booking_code","booking_date");--> statement-breakpoint
CREATE INDEX "reservation_status_start_idx" ON "reservation" USING btree ("status","start_time");--> statement-breakpoint
CREATE INDEX "reservation_user_time_idx" ON "reservation" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "reservation_booking_date_idx" ON "reservation" USING btree ("booking_date");--> statement-breakpoint
CREATE UNIQUE INDEX "room_type_code_unique" ON "room_type" USING btree ("code") WHERE "room_type"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "room_type_name_unique" ON "room_type" USING btree ("type_name") WHERE "room_type"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_name_unique" ON "rooms" USING btree ("name") WHERE "rooms"."deleted_at" IS NULL;