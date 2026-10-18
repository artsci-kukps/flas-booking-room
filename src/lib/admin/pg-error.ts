/**
 * อ่านรหัส SQLSTATE จากข้อผิดพลาดของ PostgreSQL
 *
 * Drizzle ห่อข้อผิดพลาดของ pg ไว้ใน `DrizzleQueryError` โดยเก็บของจริงไว้ที่ `cause`
 * จึงต้องตรวจทั้งตัว error เองและ cause หนึ่งชั้น เพื่อ map 23001/23505 เป็นข้อความไทย
 */
export function pgErrorCode(error: unknown): string | null {
  const direct = readCode(error);

  if (direct) {
    return direct;
  }

  if (error instanceof Error && error.cause) {
    return readCode(error.cause);
  }

  return null;
}

/** อ่านค่า `.code` แบบ string จากค่าที่ไม่รู้ชนิด */
function readCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return null;
  }

  const code = (value as { code?: unknown }).code;

  return typeof code === "string" ? code : null;
}

/**
 * อ่านข้อความข้อผิดพลาดจากตัว error เอง หรือ cause หนึ่งชั้น (Drizzle ห่อไว้)
 * ใช้คู่กับ pgErrorCode: ชื่อ constraint ของการละเมิด exclusion (23P01)
 * ปรากฏเฉพาะในข้อความ ไม่ได้อยู่ใน field `constraint` ของ PostgreSQL
 */
export function pgErrorMessage(error: unknown): string | null {
  const direct = readMessage(error);

  if (direct) {
    return direct;
  }

  if (error instanceof Error && error.cause) {
    return readMessage(error.cause);
  }

  return null;
}

/** อ่านค่า `.message` แบบ string จากค่าที่ไม่รู้ชนิด */
function readMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("message" in value)) {
    return null;
  }

  const message = (value as { message?: unknown }).message;

  return typeof message === "string" ? message : null;
}
