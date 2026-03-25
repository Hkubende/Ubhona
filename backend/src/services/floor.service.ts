import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export type FloorTableStatus = "available" | "occupied" | "reserved" | "cleaning";
export type ReservationStatus = "booked" | "arrived" | "cancelled" | "completed";
export type TableSessionStatus = "active" | "closed";

type TableRecord = {
  id: string;
  restaurant_id: string;
  branch_id: string;
  name: string;
  capacity: number;
  position_x: number;
  position_y: number;
  status: FloorTableStatus;
  created_at: string;
  updated_at: string;
};

type ReservationRecord = {
  id: string;
  restaurant_id: string;
  branch_id: string;
  table_id: string | null;
  customer_name: string;
  phone: string | null;
  party_size: number;
  reservation_time: string;
  status: ReservationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TableSessionRecord = {
  id: string;
  restaurant_id: string;
  branch_id: string;
  table_id: string;
  opened_at: string;
  closed_at: string | null;
  assigned_waiter_id: string | null;
  status: TableSessionStatus;
  guest_count: number;
  order_ids: string[];
  updated_at: string;
};

type OrderSessionLink = {
  restaurant_id: string;
  order_id: string;
  table_session_id: string;
  linked_at: string;
};

const PREFIX = {
  table: "floor_table:",
  reservation: "floor_reservation:",
  session: "floor_session:",
  orderSession: "floor_order_session:",
} as const;

const nowIso = () => new Date().toISOString();
const randomId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function tableKey(restaurantId: string, branchId: string, tableId: string) {
  return `${PREFIX.table}${restaurantId}:${branchId}:${tableId}`;
}

function reservationKey(restaurantId: string, branchId: string, reservationId: string) {
  return `${PREFIX.reservation}${restaurantId}:${branchId}:${reservationId}`;
}

function sessionKey(restaurantId: string, branchId: string, sessionId: string) {
  return `${PREFIX.session}${restaurantId}:${branchId}:${sessionId}`;
}

function orderSessionKey(restaurantId: string, orderId: string) {
  return `${PREFIX.orderSession}${restaurantId}:${orderId}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeTable(value: unknown): TableRecord | null {
  const row = asRecord(value);
  const id = String(row.id || "");
  const restaurant_id = String(row.restaurant_id || "");
  const branch_id = String(row.branch_id || "");
  if (!id || !restaurant_id || !branch_id) return null;
  const statusRaw = String(row.status || "available").toLowerCase();
  const status: FloorTableStatus =
    statusRaw === "occupied" || statusRaw === "reserved" || statusRaw === "cleaning" ? statusRaw : "available";
  return {
    id,
    restaurant_id,
    branch_id,
    name: String(row.name || ""),
    capacity: Math.max(1, Math.floor(Number(row.capacity || 2))),
    position_x: Number(row.position_x || 0),
    position_y: Number(row.position_y || 0),
    status,
    created_at: String(row.created_at || nowIso()),
    updated_at: String(row.updated_at || nowIso()),
  };
}

function normalizeReservation(value: unknown): ReservationRecord | null {
  const row = asRecord(value);
  const id = String(row.id || "");
  const restaurant_id = String(row.restaurant_id || "");
  const branch_id = String(row.branch_id || "");
  if (!id || !restaurant_id || !branch_id) return null;
  const statusRaw = String(row.status || "booked").toLowerCase();
  const status: ReservationStatus =
    statusRaw === "arrived" || statusRaw === "cancelled" || statusRaw === "completed" ? statusRaw : "booked";
  return {
    id,
    restaurant_id,
    branch_id,
    table_id: row.table_id == null ? null : String(row.table_id),
    customer_name: String(row.customer_name || ""),
    phone: row.phone == null ? null : String(row.phone),
    party_size: Math.max(1, Math.floor(Number(row.party_size || 1))),
    reservation_time: String(row.reservation_time || nowIso()),
    status,
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at || nowIso()),
    updated_at: String(row.updated_at || nowIso()),
  };
}

function normalizeSession(value: unknown): TableSessionRecord | null {
  const row = asRecord(value);
  const id = String(row.id || "");
  const restaurant_id = String(row.restaurant_id || "");
  const branch_id = String(row.branch_id || "");
  const table_id = String(row.table_id || "");
  if (!id || !restaurant_id || !branch_id || !table_id) return null;
  const statusRaw = String(row.status || "active").toLowerCase();
  const status: TableSessionStatus = statusRaw === "closed" ? "closed" : "active";
  return {
    id,
    restaurant_id,
    branch_id,
    table_id,
    opened_at: String(row.opened_at || nowIso()),
    closed_at: row.closed_at == null ? null : String(row.closed_at),
    assigned_waiter_id: row.assigned_waiter_id == null ? null : String(row.assigned_waiter_id),
    status,
    guest_count: Math.max(1, Math.floor(Number(row.guest_count || 1))),
    order_ids: Array.isArray(row.order_ids) ? row.order_ids.map((x) => String(x)).filter(Boolean) : [],
    updated_at: String(row.updated_at || nowIso()),
  };
}

function normalizeOrderSessionLink(value: unknown): OrderSessionLink | null {
  const row = asRecord(value);
  const restaurant_id = String(row.restaurant_id || "");
  const order_id = String(row.order_id || "");
  const table_session_id = String(row.table_session_id || "");
  if (!restaurant_id || !order_id || !table_session_id) return null;
  return {
    restaurant_id,
    order_id,
    table_session_id,
    linked_at: String(row.linked_at || nowIso()),
  };
}

async function upsertDoc(key: string, payload: unknown) {
  await prisma.platformTrackerDocument.upsert({
    where: { key },
    create: { key, payload: payload as Prisma.InputJsonValue },
    update: { payload: payload as Prisma.InputJsonValue },
  });
}

export async function listFloorTables(input: { restaurantId: string; branchId: string }) {
  const rows = await prisma.platformTrackerDocument.findMany({
    where: { key: { startsWith: `${PREFIX.table}${input.restaurantId}:${input.branchId}:` } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((x: { payload: unknown }) => normalizeTable(x.payload)).filter((x: TableRecord | null): x is TableRecord => !!x);
}

export async function upsertFloorTable(input: {
  restaurantId: string;
  branchId: string;
  tableId?: string;
  name: string;
  capacity?: number;
  positionX?: number;
  positionY?: number;
  status?: FloorTableStatus;
}) {
  const tableId = input.tableId || randomId("tbl");
  const key = tableKey(input.restaurantId, input.branchId, tableId);
  const existing = await prisma.platformTrackerDocument.findUnique({ where: { key }, select: { payload: true } });
  const prev = existing ? normalizeTable(existing.payload) : null;
  const next: TableRecord = {
    id: tableId,
    restaurant_id: input.restaurantId,
    branch_id: input.branchId,
    name: input.name.trim() || prev?.name || `Table ${tableId.slice(-4).toUpperCase()}`,
    capacity: Math.max(1, Math.floor(Number(input.capacity ?? prev?.capacity ?? 2))),
    position_x: Number(input.positionX ?? prev?.position_x ?? 0),
    position_y: Number(input.positionY ?? prev?.position_y ?? 0),
    status: input.status ?? prev?.status ?? "available",
    created_at: prev?.created_at || nowIso(),
    updated_at: nowIso(),
  };
  await upsertDoc(key, next);
  return next;
}

export async function setTableStatus(input: {
  restaurantId: string;
  branchId: string;
  tableId: string;
  status: FloorTableStatus;
}) {
  const row = await prisma.platformTrackerDocument.findUnique({
    where: { key: tableKey(input.restaurantId, input.branchId, input.tableId) },
    select: { payload: true },
  });
  const table = row ? normalizeTable(row.payload) : null;
  if (!table) throw new Error("Table not found.");
  const next: TableRecord = { ...table, status: input.status, updated_at: nowIso() };
  await upsertDoc(tableKey(input.restaurantId, input.branchId, input.tableId), next);
  return next;
}

export async function listReservations(input: { restaurantId: string; branchId: string }) {
  const rows = await prisma.platformTrackerDocument.findMany({
    where: { key: { startsWith: `${PREFIX.reservation}${input.restaurantId}:${input.branchId}:` } },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((x: { payload: unknown }) => normalizeReservation(x.payload))
    .filter((x: ReservationRecord | null): x is ReservationRecord => !!x)
    .sort((a: ReservationRecord, b: ReservationRecord) => a.reservation_time.localeCompare(b.reservation_time));
}

export async function createReservation(input: {
  restaurantId: string;
  branchId: string;
  customerName: string;
  phone?: string | null;
  partySize: number;
  reservationTime: string;
  tableId?: string | null;
  notes?: string | null;
}) {
  const id = randomId("res");
  const reservation: ReservationRecord = {
    id,
    restaurant_id: input.restaurantId,
    branch_id: input.branchId,
    table_id: input.tableId || null,
    customer_name: input.customerName.trim(),
    phone: input.phone?.trim() || null,
    party_size: Math.max(1, Math.floor(input.partySize)),
    reservation_time: new Date(input.reservationTime).toISOString(),
    status: "booked",
    notes: input.notes?.trim() || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await upsertDoc(reservationKey(input.restaurantId, input.branchId, id), reservation);
  if (reservation.table_id) {
    await setTableStatus({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      tableId: reservation.table_id,
      status: "reserved",
    });
  }
  return reservation;
}

export async function updateReservation(input: {
  restaurantId: string;
  branchId: string;
  reservationId: string;
  status?: ReservationStatus;
  tableId?: string | null;
  reservationTime?: string;
  partySize?: number;
  notes?: string | null;
}) {
  const key = reservationKey(input.restaurantId, input.branchId, input.reservationId);
  const row = await prisma.platformTrackerDocument.findUnique({ where: { key }, select: { payload: true } });
  const reservation = row ? normalizeReservation(row.payload) : null;
  if (!reservation) throw new Error("Reservation not found.");
  const next: ReservationRecord = {
    ...reservation,
    status: input.status ?? reservation.status,
    table_id: input.tableId === undefined ? reservation.table_id : input.tableId,
    reservation_time: input.reservationTime ? new Date(input.reservationTime).toISOString() : reservation.reservation_time,
    party_size: input.partySize ? Math.max(1, Math.floor(input.partySize)) : reservation.party_size,
    notes: input.notes === undefined ? reservation.notes : input.notes,
    updated_at: nowIso(),
  };
  await upsertDoc(key, next);
  if (next.table_id && (next.status === "booked" || next.status === "arrived")) {
    await setTableStatus({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      tableId: next.table_id,
      status: next.status === "arrived" ? "occupied" : "reserved",
    });
  }
  if (next.status === "cancelled" && reservation.table_id) {
    const activeSession = await findActiveSessionByTable({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      tableId: reservation.table_id,
    });
    if (!activeSession) {
      await setTableStatus({
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        tableId: reservation.table_id,
        status: "available",
      });
    }
  }
  return next;
}

export async function listTableSessions(input: { restaurantId: string; branchId: string }) {
  const rows = await prisma.platformTrackerDocument.findMany({
    where: { key: { startsWith: `${PREFIX.session}${input.restaurantId}:${input.branchId}:` } },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((x: { payload: unknown }) => normalizeSession(x.payload))
    .filter((x: TableSessionRecord | null): x is TableSessionRecord => !!x)
    .sort((a: TableSessionRecord, b: TableSessionRecord) => b.opened_at.localeCompare(a.opened_at));
}

export async function findActiveSessionByTable(input: { restaurantId: string; branchId: string; tableId: string }) {
  const sessions = await listTableSessions({ restaurantId: input.restaurantId, branchId: input.branchId });
  return sessions.find((session: TableSessionRecord) => session.table_id === input.tableId && session.status === "active") || null;
}

export async function openTableSession(input: {
  restaurantId: string;
  branchId: string;
  tableId: string;
  assignedWaiterId?: string | null;
  guestCount?: number;
}) {
  const existing = await findActiveSessionByTable({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    tableId: input.tableId,
  });
  if (existing) return existing;
  const session: TableSessionRecord = {
    id: randomId("ses"),
    restaurant_id: input.restaurantId,
    branch_id: input.branchId,
    table_id: input.tableId,
    opened_at: nowIso(),
    closed_at: null,
    assigned_waiter_id: input.assignedWaiterId || null,
    status: "active",
    guest_count: Math.max(1, Math.floor(Number(input.guestCount || 1))),
    order_ids: [],
    updated_at: nowIso(),
  };
  await upsertDoc(sessionKey(input.restaurantId, input.branchId, session.id), session);
  await setTableStatus({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    tableId: input.tableId,
    status: "occupied",
  });
  return session;
}

export async function closeTableSession(input: {
  restaurantId: string;
  branchId: string;
  sessionId: string;
  markStatus?: "cleaning" | "available";
}) {
  const key = sessionKey(input.restaurantId, input.branchId, input.sessionId);
  const row = await prisma.platformTrackerDocument.findUnique({ where: { key }, select: { payload: true } });
  const session = row ? normalizeSession(row.payload) : null;
  if (!session) throw new Error("Session not found.");
  const closed: TableSessionRecord = {
    ...session,
    status: "closed",
    closed_at: nowIso(),
    updated_at: nowIso(),
  };
  await upsertDoc(key, closed);
  await setTableStatus({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    tableId: session.table_id,
    status: input.markStatus || "cleaning",
  });
  return closed;
}

export async function completeCleaning(input: { restaurantId: string; branchId: string; tableId: string }) {
  return setTableStatus({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    tableId: input.tableId,
    status: "available",
  });
}

export async function attachOrderToSession(input: {
  restaurantId: string;
  branchId: string;
  sessionId: string;
  orderId: string;
}) {
  const key = sessionKey(input.restaurantId, input.branchId, input.sessionId);
  const row = await prisma.platformTrackerDocument.findUnique({ where: { key }, select: { payload: true } });
  const session = row ? normalizeSession(row.payload) : null;
  if (!session) throw new Error("Session not found.");
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    select: { id: true },
  });
  if (!order) throw new Error("Order not found.");
  const nextOrderIds = Array.from(new Set([...session.order_ids, input.orderId]));
  const next: TableSessionRecord = {
    ...session,
    order_ids: nextOrderIds,
    updated_at: nowIso(),
  };
  await upsertDoc(key, next);
  const link: OrderSessionLink = {
    restaurant_id: input.restaurantId,
    order_id: input.orderId,
    table_session_id: input.sessionId,
    linked_at: nowIso(),
  };
  await upsertDoc(orderSessionKey(input.restaurantId, input.orderId), link);
  await setTableStatus({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    tableId: session.table_id,
    status: "occupied",
  });
  return next;
}

export async function getOrderSessionLink(input: { restaurantId: string; orderId: string }) {
  const row = await prisma.platformTrackerDocument.findUnique({
    where: { key: orderSessionKey(input.restaurantId, input.orderId) },
    select: { payload: true },
  });
  return row ? normalizeOrderSessionLink(row.payload) : null;
}

async function loadOrdersByIds(restaurantId: string, orderIds: string[]) {
  if (!orderIds.length) return [];
  return prisma.order.findMany({
    where: { restaurantId, id: { in: orderIds } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

function withIdleState(session: TableSessionRecord, idleThresholdMinutes: number) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.opened_at).getTime()) / (1000 * 60)));
  return {
    ...session,
    elapsed_minutes: elapsed,
    idle_flag: session.status === "active" && elapsed >= idleThresholdMinutes,
  };
}

export async function getFloorSnapshot(input: {
  restaurantId: string;
  branchId: string;
  idleThresholdMinutes?: number;
}) {
  const idleThresholdMinutes = Math.max(10, Math.floor(Number(input.idleThresholdMinutes || 90)));
  const [tables, reservations, sessions] = await Promise.all([
    listFloorTables({ restaurantId: input.restaurantId, branchId: input.branchId }),
    listReservations({ restaurantId: input.restaurantId, branchId: input.branchId }),
    listTableSessions({ restaurantId: input.restaurantId, branchId: input.branchId }),
  ]);
  const orderIds = Array.from(new Set(sessions.flatMap((x: TableSessionRecord) => x.order_ids)));
  const orders = await loadOrdersByIds(input.restaurantId, orderIds);
  const orderById = new Map(orders.map((x) => [x.id, x]));
  const sessionsWithOrders = sessions.map((session: TableSessionRecord) => ({
    ...withIdleState(session, idleThresholdMinutes),
    orders: session.order_ids.map((id: string) => orderById.get(id)).filter(Boolean),
  }));
  const reservationsByTable = new Map<string, ReservationRecord[]>();
  for (const reservation of reservations) {
    if (!reservation.table_id) continue;
    const rows = reservationsByTable.get(reservation.table_id) || [];
    rows.push(reservation);
    reservationsByTable.set(reservation.table_id, rows);
  }
  const activeSessionByTable = new Map(
    sessionsWithOrders
      .filter((session: { status: TableSessionStatus }) => session.status === "active")
      .map((session: { table_id: string }) => [session.table_id, session])
  );
  const tablesWithMeta = tables.map((table: TableRecord) => ({
    ...table,
    active_session: activeSessionByTable.get(table.id) || null,
    reservations: reservationsByTable.get(table.id) || [],
  }));

  return {
    branch_id: input.branchId,
    tables: tablesWithMeta,
    reservations,
    sessions: sessionsWithOrders,
    realtime_token: nowIso(),
  };
}
