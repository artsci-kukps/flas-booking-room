import { NextResponse } from "next/server";

import { processOutboxBatch } from "@/lib/notifications/outbox";

/**
 * Worker ของคิว notification_outbox — pg_cron (ผ่าน pg_net) ยิงเข้ามาที่ endpoint นี้ทุกนาที
 * (ดู drizzle/0003_notification_outbox_cron.sql และ docs/notifications/outbox.md)
 *
 * ป้องกันด้วย CRON_SECRET: ต้องส่ง `Authorization: Bearer <secret>` หรือ `x-cron-secret`
 * ถ้าไม่ได้ตั้ง CRON_SECRET ฝั่งเซิร์ฟเวอร์ จะปฏิเสธ (fail closed) ไม่ทำงานเงียบ ๆ
 */

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  return (
    authorization === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret
  );
}

async function run(request: Request): Promise<NextResponse> {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า CRON_SECRET" },
      { status: 500 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processOutboxBatch();

  return NextResponse.json(result);
}

export async function GET(request: Request): Promise<NextResponse> {
  return run(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return run(request);
}
