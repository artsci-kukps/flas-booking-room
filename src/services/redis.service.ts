import { Redis } from "@upstash/redis";

/**
 * ตัวช่วย Redis (Upstash REST) ที่ใช้ร่วมกันทั้งระบบ
 * สร้าง client แบบ lazy เพื่อไม่ให้อ่าน env ตอน import (build/test ไม่มี env ก็ยังผ่าน)
 */

let client: Redis | null = null;

function getRedisClient(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error("ไม่พบ UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
    }

    client = new Redis({ url, token });
  }

  return client;
}

/** เขียนค่าพร้อมอายุ (วินาที) — ใช้เก็บรหัส OTP และคีย์ที่ต้องหมดอายุเอง */
export async function setRedis<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  await getRedisClient().set(key, value, { ex: ttlSeconds });
}

/** อ่านค่า — คืน null เมื่อไม่มีคีย์หรือคีย์หมดอายุแล้ว */
export async function getRedis<T>(key: string): Promise<T | null> {
  const value = await getRedisClient().get<T>(key);
  return value ?? null;
}

/** ลบคีย์ทันที — ใช้ล้างรหัส OTP หลังยืนยันสำเร็จหรือใช้ครบจำนวนครั้ง */
export async function delRedis(key: string): Promise<void> {
  await getRedisClient().del(key);
}

/**
 * เพิ่มตัวนับแล้วคืนค่าใหม่ — ตั้งอายุเฉพาะครั้งแรกที่สร้างคีย์
 * เพื่อให้ตัวนับรีเซ็ตเองเมื่อพ้นหน้าต่างเวลาที่กำหนด
 */
export async function incrRedis(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const redis = getRedisClient();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  return count;
}

/** อายุคงเหลือของคีย์ (วินาที) — -1 = ไม่มีคีย์, -2 = ไม่มีคีย์นี้เลย */
export async function ttlRedis(key: string): Promise<number> {
  return getRedisClient().ttl(key);
}
