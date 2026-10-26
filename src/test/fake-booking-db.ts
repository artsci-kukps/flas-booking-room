import { randomUUID } from "node:crypto";

import { getTableColumns } from "drizzle-orm";

import {
  holiday,
  reservation,
  roomBlock,
  roomType,
  rooms,
  servicePeriod,
  users,
} from "@/db/schema";

/**
 * แบบจำลองฐานข้อมูล "เล็ก" สำหรับชุดทดสอบพฤติกรรมเสี่ยง (#15)
 *
 * เทสต์ในรีโปนี้รันโดยไม่ต้องมี Postgres จริง (ดูเทสต์เดิม: reservations.test.ts,
 * day-availability.test.ts) จึงจำลองกติกาที่ DB เป็นผู้บังคับ ให้ "ซื่อตรงพอ" ต่อ
 * migration `drizzle/0001_reservation_rules.sql`:
 *   - trigger `reservation_set_derived`: booking_mode จากประเภทห้อง, booking_date
 *     = (start_time AT TIME ZONE 'Asia/Bangkok')::date
 *   - unique index `reservation_code_per_day` (booking_code, booking_date) → 23505
 *   - exclusion `reservation_room_exclusive` / `reservation_user_no_overlap` → 23P01
 *   - trigger `room_type_guard_delete` → 23001 (restrict_violation)
 *   - partial unique index ของชื่อ/รหัส rooms และ room_type (เฉพาะ deleted_at IS NULL)
 *   - `pg_advisory_xact_lock`: ล็อกแบบ transaction-scoped ต่อคีย์ (จำลองการ serialize)
 *
 * Production code (#7–#13) ถูกเรียกใช้จริงผ่าน mock ของ `@/db` ที่ชี้มาที่โมเดลนี้
 * จึงทดสอบ "คำขอพร้อมกัน" ได้จริง: promise สองตัวแทรกกันที่จุด await และ DB
 * เป็นผู้ตัดสินสุดท้าย (exclusion) หรือ advisory lock เป็นผู้ serialize (capacity)
 */

type Row = Record<string, unknown>;

/** คีย์ของแต่ละตารางในโมเดล (identity ของ object จาก schema) */
const store = new Map<unknown, Row[]>();

/** column object → ชื่อ property แบบ camelCase ที่ใช้เก็บในแถว */
const columnKey = new WeakMap<object, string>();

function cacheColumns(): void {
  for (const table of [
    servicePeriod,
    holiday,
    rooms,
    roomType,
    roomBlock,
    reservation,
    users,
  ]) {
    const columns = getTableColumns(table);

    for (const [key, column] of Object.entries(columns)) {
      columnKey.set(column as object, key);
    }
  }
}

cacheColumns();

function tableOf(column: unknown): object | null {
  if (column && typeof column === "object" && "table" in column) {
    return (column as { table: object }).table;
  }

  return null;
}

/** แปลง instant เป็นวันตามปฏิทิน Asia/Bangkok (UTC+7 คงที่ ไม่มี DST) — ตรงกับ trigger */
export function bangkokDate(instant: Date): string {
  return new Date(instant.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** สถานะที่ครองช่วงเวลา (TOR ข้อ 6.2) */
const OCCUPYING = ["PENDING", "ACTIVE"];

function rows(table: unknown): Row[] {
  let list = store.get(table);

  if (!list) {
    list = [];
    store.set(table, list);
  }

  return list;
}

// ============================================================
// ประเมินเงื่อนไข where ของ drizzle (เฉพาะ operator ที่ production ใช้)
// ============================================================

type Token =
  | { kind: "column"; column: object }
  | { kind: "operator"; text: string }
  | { kind: "param"; value: unknown }
  | { kind: "list"; values: unknown[] };

function flatten(node: unknown, out: Token[]): void {
  if (node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    out.push({
      kind: "list",
      values: node.map((element) =>
        element && typeof element === "object" && element.constructor?.name === "Param"
          ? (element as { value: unknown }).value
          : element,
      ),
    });
    return;
  }

  const name = (node as { constructor?: { name?: string } }).constructor?.name;

  if (name === "Param") {
    out.push({ kind: "param", value: (node as { value: unknown }).value });
    return;
  }

  if (name === "StringChunk") {
    const text = (node as { value: string[] }).value.join("");
    if (text.trim()) {
      out.push({ kind: "operator", text });
    }
    return;
  }

  if (typeof node === "object" && "queryChunks" in node) {
    for (const chunk of (node as { queryChunks: unknown[] }).queryChunks) {
      flatten(chunk, out);
    }
    return;
  }

  if (typeof node === "object" && "name" in node && "table" in node) {
    out.push({ kind: "column", column: node as object });
    return;
  }

  out.push({ kind: "param", value: node });
}

type Env = Map<unknown, Row>;

function resolve(column: object, env: Env): unknown {
  const table = tableOf(column);

  if (!table) {
    return undefined;
  }

  const key = columnKey.get(column);

  return env.get(table)?.[key ?? ""];
}

function compare(left: unknown, right: unknown): number {
  const l = left instanceof Date ? left.getTime() : left;
  const r = right instanceof Date ? right.getTime() : right;

  if ((l as never) < (r as never)) return -1;
  if ((l as never) > (r as never)) return 1;
  return 0;
}

function evaluate(condition: unknown, env: Env): boolean {
  const tokens: Token[] = [];
  flatten(condition, tokens);
  let pos = 0;

  function parseExpression(): boolean {
    let value = parseTerm();

    while (
      pos < tokens.length &&
      tokens[pos]!.kind === "operator" &&
      ["and", "or"].includes((tokens[pos] as { text: string }).text.trim())
    ) {
      const operator = (tokens[pos] as { text: string }).text.trim();
      pos++;
      const right = parseTerm();
      value = operator === "and" ? value && right : value || right;
    }

    return value;
  }

  function parseTerm(): boolean {
    const token = tokens[pos];

    if (token?.kind === "operator" && token.text.trim() === "(") {
      pos++;
      const value = parseExpression();
      pos++; //  ')'
      return value;
    }

    const column = (tokens[pos] as { column: object }).column;
    pos++;
    const operator = (tokens[pos] as { text: string }).text.trim();
    pos++;

    if (operator === "is null") {
      return resolve(column, env) == null;
    }

    if (operator === "is not null") {
      return resolve(column, env) != null;
    }

    const operand = tokens[pos];
    pos++;

    // ค่าขวามืออาจเป็น "คอลัมน์อีกตาราง" (เงื่อนไข join: eq(rooms.roomTypeId, roomType.id))
    // ต้อง resolve จากแถวใน env ของ trial ก่อนเทียบ — ไม่ใช่อ่านเป็น parameter
    const value =
      operand?.kind === "list"
        ? operand.values
        : operand?.kind === "column"
          ? resolve(operand.column, env)
          : (operand as { value: unknown } | undefined)?.value;
    const left = resolve(column, env);

    switch (operator) {
      case "=":
        return compare(left, value) === 0;
      case "<>":
      case "!=":
        return compare(left, value) !== 0;
      case "<":
        return compare(left, value) < 0;
      case ">":
        return compare(left, value) > 0;
      case "<=":
        return compare(left, value) <= 0;
      case ">=":
        return compare(left, value) >= 0;
      case "in":
        return (value as unknown[]).some((candidate) => compare(left, candidate) === 0);
      default:
        throw new Error(`[fake-db] ยังไม่รองรับ operator: ${operator}`);
    }
  }

  return parseExpression();
}

// ============================================================
// projection / join
// ============================================================

type Projection = Record<string, unknown>;

function project(projection: Projection | undefined, env: Env): Row {
  if (!projection) {
    const [row] = [...env.values()];

    return { ...(row ?? {}) };
  }

  const out: Row = {};

  for (const [key, column] of Object.entries(projection)) {
    out[key] = resolve(column as object, env);
  }

  return out;
}

// ============================================================
// select
// ============================================================

type SelectState = {
  projection?: Projection;
  table?: unknown;
  joins: { table: unknown; condition: unknown }[];
  condition?: unknown;
  limit?: number;
};

function executeSelect(state: SelectState): Row[] {
  const base = state.table;
  const result: Row[] = [];

  for (const baseRow of rows(base)) {
    const env: Env = new Map([[base, baseRow]]);
    let matched = true;

    for (const join of state.joins) {
      const candidate = rows(join.table).find((row) => {
        const trial: Env = new Map(env);
        trial.set(join.table, row);
        return evaluate(join.condition, trial);
      });

      if (!candidate) {
        matched = false;
        break;
      }

      env.set(join.table, candidate);
    }

    if (!matched) {
      continue;
    }

    if (state.condition && !evaluate(state.condition, env)) {
      continue;
    }

    result.push(project(state.projection, env));
  }

  return state.limit === undefined ? result : result.slice(0, state.limit);
}

function select(projection?: Projection) {
  const state: SelectState = { projection, joins: [] };

  const builder = {
    from(table: unknown) {
      state.table = table;
      return builder;
    },
    innerJoin(table: unknown, condition: unknown) {
      state.joins.push({ table, condition });
      return builder;
    },
    where(condition: unknown) {
      state.condition = condition;
      return builder;
    },
    orderBy() {
      return Promise.resolve(executeSelect(state));
    },
    limit(count: number) {
      state.limit = count;
      return Promise.resolve(executeSelect(state));
    },
    then(resolve_: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(executeSelect(state)).then(resolve_, reject);
    },
  };

  return builder;
}

// ============================================================
// ข้อผิดพลาดแบบ pg (Drizzle ห่อ cause ไว้ — helper ของ production อ่านทั้งคู่)
// ============================================================

function pgError(code: string, message: string): Error {
  const cause = Object.assign(new Error(message), { code });

  return new Error(`Failed query: ${message}\nparams: [...]`, { cause });
}

const roomExclusiveViolation = () =>
  pgError(
    "23P01",
    'conflicting key value violates exclusion constraint "reservation_room_exclusive", key',
  );

const userNoOverlapViolation = () =>
  pgError(
    "23P01",
    'conflicting key value violates exclusion constraint "reservation_user_no_overlap", key',
  );

const codePerDayViolation = () =>
  pgError("23505", 'duplicate key value violates unique constraint "reservation_code_per_day"');

const guardViolation = () =>
  pgError("23001", "room_type still has active rooms");

const nameUniqueViolation = (index: string) =>
  pgError("23505", `duplicate key value violates unique constraint "${index}"`);

// ============================================================
// กติกาต่อตาราง (trigger + constraint)
// ============================================================

function occupying(row: Row): boolean {
  return OCCUPYING.includes(row.status as string);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function assertReservation(row: Row): void {
  const conflict = rows(reservation).find(
    (existing) => existing.bookingCode === row.bookingCode && existing.bookingDate === row.bookingDate,
  );

  if (conflict) {
    throw codePerDayViolation();
  }

  const sameRoom = rows(reservation).find(
    (existing) =>
      existing.roomId === row.roomId &&
      existing.bookingMode === "EXCLUSIVE" &&
      occupying(existing) &&
      overlaps(
        row.startTime as Date,
        row.endTime as Date,
        existing.startTime as Date,
        existing.endTime as Date,
      ),
  );

  if (sameRoom && row.bookingMode === "EXCLUSIVE") {
    throw roomExclusiveViolation();
  }

  const sameUser = rows(reservation).find(
    (existing) =>
      existing.userId === row.userId &&
      occupying(existing) &&
      overlaps(
        row.startTime as Date,
        row.endTime as Date,
        existing.startTime as Date,
        existing.endTime as Date,
      ),
  );

  if (sameUser) {
    throw userNoOverlapViolation();
  }
}

function assertActiveUnique(
  table: unknown,
  candidate: Row,
  fields: string[],
  indexName: string,
  excludeId?: unknown,
): void {
  const conflict = rows(table).find(
    (existing) =>
      existing.id !== excludeId &&
      existing.deletedAt == null &&
      fields.some((field) => existing[field] === candidate[field]),
  );

  if (conflict) {
    throw nameUniqueViolation(indexName);
  }
}

/** เตรียมค่าเริ่มต้นของแถวก่อนตรวจ constraint */
function prepareRow(table: unknown, values: Row): Row {
  const row: Row = { id: values.id ?? randomUUID(), ...values };

  if (row.createdAt === undefined) {
    row.createdAt = new Date();
  }

  if (table === rooms || table === roomType) {
    row.deletedAt = row.deletedAt ?? null;
    row.deletedBy = row.deletedBy ?? null;
  }

  if (table === reservation) {
    row.status = row.status ?? "PENDING";
    const room = rows(rooms).find((candidate) => candidate.id === row.roomId);
    const type = room
      ? rows(roomType).find((candidate) => candidate.id === room.roomTypeId)
      : undefined;

    if (type) {
      row.bookingMode = type.bookingMode;
    }

    row.bookingDate = bangkokDate(row.startTime as Date);
  }

  return row;
}

function checkInvariants(table: unknown, row: Row, excludeId?: unknown): void {
  if (table === reservation) {
    assertReservation(row);
  }

  if (table === rooms) {
    assertActiveUnique(rooms, row, ["name"], "rooms_name_unique", excludeId);
  }

  if (table === roomType) {
    assertActiveUnique(roomType, row, ["code"], "room_type_code_unique", excludeId);
    assertActiveUnique(roomType, row, ["typeName"], "room_type_name_unique", excludeId);
  }
}

// ============================================================
// insert / update / execute / transaction
// ============================================================

function insert(table: unknown) {
  return {
    values(values: Row) {
      const run = (): Row => {
        const row = prepareRow(table, values);
        checkInvariants(table, row);
        rows(table).push(row);

        return row;
      };

      return {
        returning(projection?: Projection) {
          return Promise.resolve().then(() => [
            project(projection, new Map([[table, run()]])),
          ]);
        },
        then(resolve_: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve()
            .then(() => {
              run();
              return [] as Row[];
            })
            .then(resolve_, reject);
        },
      };
    },
  };
}

function guardRoomTypeDelete(oldRow: Row, newRow: Row): void {
  if (newRow.deletedAt != null && oldRow.deletedAt == null) {
    const activeRooms = rows(rooms).some(
      (room) => room.roomTypeId === newRow.id && room.deletedAt == null,
    );

    if (activeRooms) {
      throw guardViolation();
    }
  }
}

function update(table: unknown) {
  return {
    set(values: Row) {
      return {
        where(condition: unknown) {
          const run = (): Row[] => {
            const list = rows(table);
            const snapshot = list.map((row) => ({ ...row }));
            const targets = list.filter((row) =>
              evaluate(condition, new Map([[table, row]])),
            );

            try {
              // ตรวจกติกาก่อน จากนั้นค่อยเขียนทับ "แถวเดิมใน store" (ไม่ใช่สำเนา)
              for (const target of targets) {
                const next: Row = { ...target, ...values };

                if (table === roomType) {
                  guardRoomTypeDelete(target, next);
                }

                if (table === rooms || table === roomType) {
                  checkInvariants(table, next, target.id);
                }
              }

              for (const target of targets) {
                Object.assign(target, values);
              }
            } catch (error) {
              list.length = 0;
              list.push(...snapshot);
              throw error;
            }

            return targets;
          };

          // รอจน execute แล้วคืน "แถวที่ถูกแก้" (สำเนา) — ตรงกับ drizzle ที่คืนผลเมื่อ await
          const affected = (): Promise<Row[]> =>
            Promise.resolve()
              .then(run)
              .then((targets) => targets.map((row) => ({ ...row })));

          return {
            returning(projection?: Projection) {
              return Promise.resolve()
                .then(run)
                .then((targets) =>
                  targets.map((row) => project(projection, new Map([[table, row]]))),
                );
            },
            then(resolve_: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
              return affected().then(resolve_, reject);
            },
          };
        },
      };
    },
  };
}

// ============================================================
// advisory lock (transaction-scoped)
// ============================================================

const lockTails = new Map<string, Promise<void>>();

async function acquire(key: string): Promise<() => void> {
  const previous = lockTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  lockTails.set(key, previous.then(() => current));
  await previous;

  return release;
}

/** ดึงคีย์ล็อกจาก SQL object — hashtextextended(roomId) หรือค่าคงที่ของ rooms/room_types */
function lockKey(query: unknown): string | null {
  if (!query || typeof query !== "object" || !("queryChunks" in query)) {
    return null;
  }

  const chunks = (query as { queryChunks: unknown[] }).queryChunks;
  const text = chunks
    .filter(
      (chunk): chunk is { value: string[] } =>
        !!chunk && typeof chunk === "object" && "value" in chunk && Array.isArray((chunk as { value: unknown }).value),
    )
    .flatMap((chunk) => chunk.value)
    .join("");

  if (!text.includes("pg_advisory_xact_lock")) {
    return null;
  }

  // ค่าที่ interpolate ได้เป็น string/number ตรง ๆ หรือ Param (ต่างเวอร์ชันของ drizzle)
  const param = chunks
    .map((chunk) => {
      if (typeof chunk === "string" || typeof chunk === "number") {
        return chunk;
      }

      if (chunk && typeof chunk === "object" && chunk.constructor?.name === "Param") {
        return (chunk as { value: unknown }).value;
      }

      return undefined;
    })
    .find((value) => value !== undefined);

  if (param === undefined) {
    return null;
  }

  return text.includes("hashtextextended") ? `hash:${String(param)}` : `key:${String(param)}`;
}

function makeExecute(held: (() => void)[], heldKeys: Set<string>) {
  return async (query: unknown): Promise<Row[]> => {
    const key = lockKey(query);

    if (!key) {
      return [];
    }

    // pg_advisory_xact_lock ซ้ำคีย์เดิมในทรานแซกชันเดียวเป็น no-op
    if (heldKeys.has(key)) {
      return [];
    }

    heldKeys.add(key);
    held.push(await acquire(key));

    return [];
  };
}

// ============================================================
// ตัวช่วย seed / reset / อ่านผล สำหรับเทสต์
// ============================================================

/** เพิ่มแถวตรง ๆ (ไม่ผ่าน constraint) — ใช้เตรียมสถานะตั้งต้นของการทดสอบ */
export function seed(table: unknown, values: Row[]): void {
  for (const value of values) {
    rows(table).push({ id: value.id ?? randomUUID(), ...value });
  }
}

/**
 * จำลอง INSERT ดิบที่ผ่าน trigger + constraint ของตาราง (ต่างจาก seed ที่ข้ามทั้งหมด)
 * ใช้ทดสอบผลของ trigger `reservation_set_derived` และ unique/exclusion ต่อวัน
 */
export function insertRaw(table: unknown, values: Row): Row {
  const row = prepareRow(table, values);
  checkInvariants(table, row);
  rows(table).push(row);

  return row;
}

export function resetFakeDb(): void {
  store.clear();
  lockTails.clear();
}

/** แถวทั้งหมดของตาราง (สำเนา) — สำหรับยืนยัน "แถวยังอยู่ / FK ยังชี้" */
export function tableRows(table: unknown): Row[] {
  return rows(table).map((row) => ({ ...row }));
}

export function countRows(table: unknown): number {
  return rows(table).length;
}

/** จำนวนสูงสุดของช่วงเวลาที่ครองซ้อนกันในห้องหนึ่ง (ใช้ตรวจ capacity ภายใต้ concurrency) */
export function maxConcurrentOccupancy(roomId: string): number {
  const occupyingRows = rows(reservation)
    .filter((row) => row.roomId === roomId && occupying(row))
    .map((row) => ({ start: row.startTime as Date, end: row.endTime as Date }));

  const points = [
    ...new Set(occupyingRows.flatMap((row) => [row.start.getTime(), row.end.getTime()])),
  ].sort((a, b) => a - b);

  let maximum = 0;

  for (const point of points) {
    const count = occupyingRows.filter(
      (row) => row.start.getTime() <= point && row.end.getTime() > point,
    ).length;
    maximum = Math.max(maximum, count);
  }

  return maximum;
}

const db = {
  select,
  insert,
  update,
  execute: makeExecute([], new Set<string>()),
  transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
    const held: (() => void)[] = [];
    const heldKeys = new Set<string>();

    const tx = {
      select,
      insert,
      update,
      execute: makeExecute(held, heldKeys),
    };

    try {
      return await callback(tx);
    } finally {
      for (const release of held.reverse()) {
        release();
      }
    }
  },
};

/** mock ของ `@/db` — เทสต์อ้างถึงเพื่อ seed/reset และอ่านผล */
export const fakeDb = db;

/** ตารางที่ใช้ seed จากเทสต์ */
export const tables = {
  servicePeriod,
  holiday,
  rooms,
  roomType,
  roomBlock,
  reservation,
  users,
};
