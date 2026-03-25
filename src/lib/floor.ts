import { api } from "./api";

export type FloorTableStatus = "available" | "occupied" | "reserved" | "cleaning";
export type ReservationStatus = "booked" | "arrived" | "cancelled" | "completed";

export type FloorTable = {
  id: string;
  restaurant_id: string;
  branch_id: string;
  name: string;
  capacity: number;
  position_x: number;
  position_y: number;
  status: FloorTableStatus;
  active_session: FloorSession | null;
  reservations: FloorReservation[];
  created_at: string;
  updated_at: string;
};

export type FloorReservation = {
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

export type FloorSession = {
  id: string;
  restaurant_id: string;
  branch_id: string;
  table_id: string;
  opened_at: string;
  closed_at: string | null;
  assigned_waiter_id: string | null;
  status: "active" | "closed";
  guest_count: number;
  order_ids: string[];
  elapsed_minutes: number;
  idle_flag: boolean;
  updated_at: string;
  orders: Array<{
    id: string;
    status: string;
    customerName: string | null;
    tableNumber: string | null;
    totalAmount: number;
    paymentStatus: string;
    createdAt: string;
  }>;
};

export type FloorSnapshot = {
  branch_id: string;
  tables: FloorTable[];
  reservations: FloorReservation[];
  sessions: FloorSession[];
  realtime_token: string;
};

export async function getFloorSnapshot(branchId = "main") {
  return api.get<FloorSnapshot>(`/floor/snapshot?branchId=${encodeURIComponent(branchId)}`);
}

export async function saveTable(input: {
  tableId?: string;
  branchId: string;
  name: string;
  capacity?: number;
  positionX?: number;
  positionY?: number;
  status?: FloorTableStatus;
}) {
  return api.post("/floor/tables", input);
}

export async function setTableStatus(input: { tableId: string; branchId: string; status: FloorTableStatus }) {
  return api.patch(`/floor/tables/${encodeURIComponent(input.tableId)}/status`, {
    branchId: input.branchId,
    status: input.status,
  });
}

export async function markCleaningComplete(input: { tableId: string; branchId: string }) {
  return api.post(`/floor/tables/${encodeURIComponent(input.tableId)}/cleaning-complete`, {
    branchId: input.branchId,
  });
}

export async function createReservation(input: {
  branchId: string;
  customerName: string;
  phone?: string;
  partySize: number;
  reservationTime: string;
  tableId?: string;
  notes?: string;
}) {
  return api.post<FloorReservation>("/floor/reservations", input);
}

export async function updateReservation(input: {
  reservationId: string;
  branchId: string;
  status?: ReservationStatus;
  tableId?: string | null;
  reservationTime?: string;
  partySize?: number;
  notes?: string | null;
}) {
  return api.patch<FloorReservation>(`/floor/reservations/${encodeURIComponent(input.reservationId)}`, {
    branchId: input.branchId,
    status: input.status,
    tableId: input.tableId,
    reservationTime: input.reservationTime,
    partySize: input.partySize,
    notes: input.notes,
  });
}

export async function openSession(input: {
  branchId: string;
  tableId: string;
  assignedWaiterId?: string;
  guestCount?: number;
}) {
  return api.post<FloorSession>("/floor/sessions/open", input);
}

export async function closeSession(input: {
  sessionId: string;
  branchId: string;
  markStatus?: "cleaning" | "available";
}) {
  return api.post<FloorSession>(`/floor/sessions/${encodeURIComponent(input.sessionId)}/close`, {
    branchId: input.branchId,
    markStatus: input.markStatus,
  });
}

export async function attachOrder(input: {
  sessionId: string;
  branchId: string;
  orderId: string;
}) {
  return api.post(`/floor/sessions/${encodeURIComponent(input.sessionId)}/orders`, {
    branchId: input.branchId,
    orderId: input.orderId,
  });
}
