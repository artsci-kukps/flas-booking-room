import { and, asc, eq, lte } from "drizzle-orm";

import db from "@/db";
import { notificationOutbox, type NewNotificationOutbox } from "@/db/schema";
import {
  bookingCancellationEmailSubject,
  renderBookingCancellationEmail,
} from "@/services/emails/booking-cancellation";
import { bookingCodeEmailSubject, renderBookingCodeEmail } from "@/services/emails/booking-code";
import {
  sendEmailViaResend,
  type EmailMessage,
  type EmailSender,
} from "@/services/resend.service";

/**
 * คิวส่งอีเมล notification_outbox (TOR ข้อ 11)
 * - enqueue: จองสำเร็จ → สร้างรายการ PENDING หนึ่งรายการต่อการจองหนึ่งระเบียน
 *            ยกเลิกการจอง → สร้างรายการ PENDING แจ้งเตือนการยกเลิก (#21)
 * - process: หยิบรายการ PENDING ที่ถึงเวลา (next_attempt_at) ไปส่งผ่าน Resend
 *            สำเร็จ → SENT + sent_at; ล้มเหลว → เพิ่ม attempts + ตั้ง retry; ครบขีดจำกัด → FAILED + last_error
 * นโยบาย retry / รูปแบบอีเมล ตัดสินในตั๋ว #14 (ภาคผนวก B.2) — ดู docs/notifications/outbox.md
 * การเรียก process มาจาก pg_cron ผ่าน route /api/cron/outbox (ดู drizzle/0003_notification_outbox_cron.sql)
 */

export const BOOKING_CODE_EMAIL_TYPE = "BOOKING_CODE";

/** ประเภทการแจ้งเตือน: อีเมลแจ้งเตือนการยกเลิกการจอง (ticket #21) */
export const BOOKING_CANCELLED_EMAIL_TYPE = "BOOKING_CANCELLED";

/** จำนวนครั้งสูงสุดที่พยายามส่ง (ครั้งแรก + retry) — เกินนี้เป็น FAILED */
export const MAX_OUTBOX_ATTEMPTS = 5;

/** ระยะห่างก่อนลองใหม่หลังล้มเหลวครั้งที่ 1..4 (นาที): 1, 5, 15, 60 */
export const OUTBOX_RETRY_DELAYS_MS: readonly number[] = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
];

/** จำนวนรายการสูงสุดต่อรอบการประมวลผล */
export const OUTBOX_BATCH_SIZE = 20;

/** ความยาวสูงสุดของ last_error ที่เก็บลงฐานข้อมูล */
const MAX_LAST_ERROR_LENGTH = 1000;

/**
 * เวลาที่ควรลองใหม่หลัง "ล้มเหลวไปแล้ว attempts ครั้ง"
 * คืน null เมื่อถึงขีดจำกัด (ให้ผู้เรียกตั้งสถานะ FAILED)
 */
export function nextRetryAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_OUTBOX_ATTEMPTS) {
    return null;
  }

  const delay = OUTBOX_RETRY_DELAYS_MS[attempts - 1];

  return delay === undefined ? null : new Date(now.getTime() + delay);
}

/** ข้อมูลที่ใช้สร้างอีเมลรหัสการจอง — เก็บเป็น jsonb ในคอลัมน์ payload */
export type BookingCodePayload = {
  bookingCode: string;
  roomName: string;
  /** 'YYYY-MM-DD' */
  bookingDate: string;
  /** ISO 8601 */
  startTime: string;
  /** ISO 8601 */
  endTime: string;
};

export type EnqueueBookingCodeEmail = {
  reservationId: string;
  toEmail: string;
  bookingCode: string;
  roomName: string;
  bookingDate: string;
  startTime: Date;
  endTime: Date;
};

/** ข้อมูลที่ใช้สร้างอีเมลแจ้งเตือนการยกเลิก — เก็บเป็น jsonb ในคอลัมน์ payload */
export type BookingCancelledPayload = {
  bookingCode: string;
  roomName: string;
  /** 'YYYY-MM-DD' */
  bookingDate: string;
  /** ISO 8601 */
  startTime: string;
  /** ISO 8601 */
  endTime: string;
  /** เหตุผลการยกเลิก — null เมื่อผู้ใช้ยกเลิกเอง (ไม่ต้องระบุเหตุผล) */
  reason: string | null;
};

export type EnqueueBookingCancellationEmail = {
  reservationId: string;
  toEmail: string;
  bookingCode: string;
  roomName: string;
  bookingDate: string;
  startTime: Date;
  endTime: Date;
  reason?: string | null;
};

/** ตัวเขียนคิว — รับได้ทั้ง db และ transaction ของ drizzle (ผู้เรียกหลาย record ใช้ tx เดียวกันได้) */
export type OutboxExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type EnqueueBookingCodeEmailFn = (
  input: EnqueueBookingCodeEmail,
  executor?: OutboxExecutor,
) => Promise<void>;

export type EnqueueBookingCancellationEmailFn = (
  input: EnqueueBookingCancellationEmail,
  executor?: OutboxExecutor,
) => Promise<void>;

/**
 * สร้างรายการคิวส่งรหัสการจอง (PENDING, next_attempt_at = now())
 * เรียกหนึ่งครั้งต่อการจองหนึ่งระเบียน — การจองหลายบล็อกที่สร้างหลายระเบียนจึงได้หลายอีเมล
 * ส่ง executor (tx) เดียวกับที่ insert การจอง เพื่อให้คิวและตัวการจอง commit/rollback พร้อมกัน
 */
export async function enqueueBookingCodeEmail(
  input: EnqueueBookingCodeEmail,
  executor: OutboxExecutor = db as unknown as OutboxExecutor,
): Promise<void> {
  const payload: BookingCodePayload = {
    bookingCode: input.bookingCode,
    roomName: input.roomName,
    bookingDate: input.bookingDate,
    startTime: input.startTime.toISOString(),
    endTime: input.endTime.toISOString(),
  };

  await executor.insert(notificationOutbox).values({
    reservationId: input.reservationId,
    type: BOOKING_CODE_EMAIL_TYPE,
    toEmail: input.toEmail,
    subject: bookingCodeEmailSubject(input.bookingCode),
    payload,
  });
}

/**
 * สร้างรายการคิวแจ้งเตือนการยกเลิกการจอง (PENDING, next_attempt_at = now())
 * เรียกหลังการยกเลิกสำเร็จ — reason เป็น null ได้เมื่อผู้ใช้ยกเลิกเอง (TOR ข้อ 6.4)
 * ส่ง executor (tx) เดียวกับที่ update การจองได้ หากต้องการให้คิวและตัวการยกเลิก commit/rollback พร้อมกัน
 */
export async function enqueueBookingCancellationEmail(
  input: EnqueueBookingCancellationEmail,
  executor: OutboxExecutor = db as unknown as OutboxExecutor,
): Promise<void> {
  const reason = input.reason?.trim() || null;

  const payload: BookingCancelledPayload = {
    bookingCode: input.bookingCode,
    roomName: input.roomName,
    bookingDate: input.bookingDate,
    startTime: input.startTime.toISOString(),
    endTime: input.endTime.toISOString(),
    reason,
  };

  await executor.insert(notificationOutbox).values({
    reservationId: input.reservationId,
    type: BOOKING_CANCELLED_EMAIL_TYPE,
    toEmail: input.toEmail,
    subject: bookingCancellationEmailSubject(input.bookingCode),
    payload,
  });
}

/** ฟิลด์อ้างอิงการจองที่ payload ทุกประเภทใช้ร่วมกัน */
type BookingRefPayload = {
  bookingCode: string;
  roomName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
};

/** ตรวจและดึงรหัส/ห้อง/ช่วงเวลาที่ทุก payload ต้องมี — คืน null เมื่อผิดรูปแบบ */
function parseBookingRefPayload(payload: unknown): BookingRefPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const { bookingCode, roomName, bookingDate, startTime, endTime } = candidate;

  const strings = [bookingCode, roomName, bookingDate, startTime, endTime];
  if (strings.some((value) => typeof value !== "string" || value === "")) {
    return null;
  }

  if (
    Number.isNaN(new Date(startTime as string).getTime()) ||
    Number.isNaN(new Date(endTime as string).getTime())
  ) {
    return null;
  }

  return {
    bookingCode: bookingCode as string,
    roomName: roomName as string,
    bookingDate: bookingDate as string,
    startTime: startTime as string,
    endTime: endTime as string,
  };
}

/** อ่าน payload ของ BOOKING_CODE — คืน null เมื่อรูปแบบไม่ครบ (ถือเป็นความผิดพลาดถาวร) */
function parseBookingCodePayload(payload: unknown): BookingCodePayload | null {
  return parseBookingRefPayload(payload);
}

/** reason ไม่บังคับ แต่ถ้ามีต้องเป็น string (null/undefined ได้) */
function parseBookingCancelledPayload(payload: unknown): BookingCancelledPayload | null {
  const base = parseBookingRefPayload(payload);

  if (!base) {
    return null;
  }

  const rawReason = (payload as Record<string, unknown>).reason;

  if (rawReason !== undefined && rawReason !== null && typeof rawReason !== "string") {
    return null;
  }

  return { ...base, reason: typeof rawReason === "string" ? rawReason : null };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return message.length > MAX_LAST_ERROR_LENGTH
    ? message.slice(0, MAX_LAST_ERROR_LENGTH)
    : message;
}

export type ProcessOutboxDeps = {
  /** เวลาอ้างอิงของรอบนี้ (ฉีดได้เพื่อเทสต์) */
  now?: Date;
  /** ตัวส่งอีเมล (ฉีดได้เพื่อเทสต์ — ค่าเริ่มต้นคือ Resend) */
  sender?: EmailSender;
  batchSize?: number;
};

export type OutboxBatchResult = {
  sent: number;
  retried: number;
  failed: number;
};

/**
 * ประมวลผลคิวหนึ่งรอบ: เลือก PENDING ที่ถึงเวลา แล้วส่งทีละรายการ
 * ข้อผิดพลาด "ถาวร" (payload ผิดรูปแบบ) ไม่ต้อง retry → FAILED ทันที
 */
export async function processOutboxBatch(
  deps: ProcessOutboxDeps = {},
): Promise<OutboxBatchResult> {
  const now = deps.now ?? new Date();
  const sender = deps.sender ?? sendEmailViaResend;
  const batchSize = deps.batchSize ?? OUTBOX_BATCH_SIZE;

  const due = await db
    .select()
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.status, "PENDING"),
        lte(notificationOutbox.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(notificationOutbox.nextAttemptAt))
    .limit(batchSize);

  const result: OutboxBatchResult = { sent: 0, retried: 0, failed: 0 };

  for (const row of due) {
    const attempts = row.attempts + 1;

    let message: EmailMessage | null = null;
    let permanentError: string | null = null;

    if (row.type === BOOKING_CODE_EMAIL_TYPE) {
      const payload = parseBookingCodePayload(row.payload);

      if (payload) {
        const mail = renderBookingCodeEmail({
          bookingCode: payload.bookingCode,
          roomName: payload.roomName,
          bookingDate: payload.bookingDate,
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
        });

        message = { to: row.toEmail, ...mail };
      } else {
        permanentError = `payload ของรายการ ${row.id} ผิดรูปแบบ (type=${row.type})`;
      }
    } else if (row.type === BOOKING_CANCELLED_EMAIL_TYPE) {
      const payload = parseBookingCancelledPayload(row.payload);

      if (payload) {
        const mail = renderBookingCancellationEmail({
          bookingCode: payload.bookingCode,
          roomName: payload.roomName,
          bookingDate: payload.bookingDate,
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
          reason: payload.reason,
        });

        message = { to: row.toEmail, ...mail };
      } else {
        permanentError = `payload ของรายการ ${row.id} ผิดรูปแบบ (type=${row.type})`;
      }
    } else {
      permanentError = `ไม่รู้จักประเภทการแจ้งเตือน ${row.type}`;
    }

    if (message) {
      try {
        await sender(message);
        await db
          .update(notificationOutbox)
          .set({ status: "SENT", sentAt: now, lastError: null })
          .where(eq(notificationOutbox.id, row.id));
        result.sent++;
        continue;
      } catch (error) {
        await recordFailure(row.id, attempts, errorMessage(error), now, result);
        continue;
      }
    }

    await recordFailure(
      row.id,
      attempts,
      permanentError ?? "payload ไม่ถูกต้อง",
      now,
      result,
      { retryable: false },
    );
  }

  return result;
}

/** อัปเดตผลล้มเหลว: ตั้ง retry ถ้ายังเหลือโควตา ไม่งั้นเป็น FAILED */
async function recordFailure(
  id: string,
  attempts: number,
  lastError: string,
  now: Date,
  result: OutboxBatchResult,
  { retryable = true }: { retryable?: boolean } = {},
): Promise<void> {
  const retryAt = retryable ? nextRetryAt(attempts, now) : null;

  const update: Partial<NewNotificationOutbox> = retryAt
    ? { attempts, lastError, nextAttemptAt: retryAt }
    : { attempts, lastError, status: "FAILED" };

  await db.update(notificationOutbox).set(update).where(eq(notificationOutbox.id, id));

  if (retryAt) {
    result.retried++;
  } else {
    result.failed++;
  }
}
