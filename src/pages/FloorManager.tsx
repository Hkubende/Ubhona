import * as React from "react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ActionBar,
  ContentGrid,
  DashboardPanel,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import type { RestaurantProfile } from "../lib/restaurant";
import {
  attachOrder,
  closeSession,
  createReservation,
  getFloorSnapshot,
  markCleaningComplete,
  openSession,
  saveTable,
  setTableStatus,
  updateReservation,
  type FloorReservation,
  type FloorSession,
  type FloorSnapshot,
  type FloorTable,
} from "../lib/floor";
import { canPerformAction } from "../lib/roles";

function statusTone(status: FloorTable["status"]) {
  if (status === "occupied") return "border-primary/50 bg-primary/12 text-text-primary";
  if (status === "reserved") return "border-amber-300/45 bg-amber-300/10 text-amber-100";
  if (status === "cleaning") return "border-sky-300/45 bg-sky-300/10 text-sky-100";
  return "border-emerald-300/45 bg-emerald-300/10 text-emerald-100";
}

function tableBadge(status: FloorTable["status"]) {
  if (status === "occupied") return <Badge variant="accent">Occupied</Badge>;
  if (status === "reserved") return <Badge variant="warning">Reserved</Badge>;
  if (status === "cleaning") return <Badge variant="neutral">Cleaning</Badge>;
  return <Badge variant="success">Available</Badge>;
}

export default function FloorManagerPage() {
  const { data } = useRestaurantDashboard();
  const [snapshot, setSnapshot] = React.useState<FloorSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [branchId, setBranchId] = React.useState("main");
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [newTableName, setNewTableName] = React.useState("");
  const [newTableCapacity, setNewTableCapacity] = React.useState("4");
  const [reservationName, setReservationName] = React.useState("");
  const [reservationPhone, setReservationPhone] = React.useState("");
  const [reservationPartySize, setReservationPartySize] = React.useState("2");
  const [reservationTime, setReservationTime] = React.useState("");
  const [reservationTableId, setReservationTableId] = React.useState("");
  const [sessionGuestCount, setSessionGuestCount] = React.useState("2");
  const [attachOrderId, setAttachOrderId] = React.useState("");
  const canvasRef = React.useRef<HTMLDivElement | null>(null);

  const canCreateOrder = canPerformAction("create_order");
  const canUpdateService = canPerformAction("update_service_order_status");

  const load = React.useCallback(async () => {
    try {
      const next = await getFloorSnapshot(branchId);
      setSnapshot(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load floor snapshot.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  React.useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 3500);
    return () => window.clearInterval(interval);
  }, [load]);

  const profile = React.useMemo<RestaurantProfile | null>(() => {
    if (!data) return null;
    return {
      id: data.restaurant.id,
      restaurantName: data.restaurant.name,
      slug: data.restaurant.slug,
      phone: data.restaurant.phone,
      email: data.restaurant.email,
      location: data.restaurant.location,
      logo: data.brandingSettings.logoUrl || data.restaurant.logoUrl,
      coverImage: data.brandingSettings.coverImageUrl || data.restaurant.coverImageUrl,
      themePrimary: data.brandingSettings.primaryColor || data.restaurant.primaryColor,
      themeSecondary: "#E8D8C3",
      shortDescription: data.brandingSettings.description || data.restaurant.description,
      subscriptionPlan: data.restaurant.subscriptionPlan || "starter",
      subscriptionStatus: data.restaurant.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [data]);

  const tables = snapshot?.tables || [];
  const selectedTable = tables.find((x) => x.id === selectedTableId) || null;
  const reservations = snapshot?.reservations || [];
  const activeSession: FloorSession | null = selectedTable?.active_session || null;
  const floorErrorTitle = error.includes("static/demo mode")
    ? "Live floor sync is unavailable"
    : "Floor data unavailable";
  const floorErrorMessage = error.includes("static/demo mode")
    ? "You can continue planning tables in demo mode. Live floor sync will appear here once the floor service is connected."
    : error;

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Floor action failed.");
    } finally {
      setBusy(null);
    }
  }

  function onTableDragEnd(table: FloorTable, event: React.DragEvent<HTMLButtonElement>) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 130, event.clientX - rect.left - 65));
    const y = Math.max(0, Math.min(rect.height - 88, event.clientY - rect.top - 44));
    void run("move_table", async () => {
      await saveTable({
        tableId: table.id,
        branchId,
        name: table.name,
        capacity: table.capacity,
        positionX: Math.round(x),
        positionY: Math.round(y),
        status: table.status,
      });
    });
  }

  return (
    <DashboardLayout
      profile={profile}
      title="Floor Management"
      subtitle="Visual table operations, reservations, and dine-in sessions by branch."
      actions={
        <div className="flex items-center gap-2">
          <Input
            id="floor-branch-id"
            name="floorBranchId"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value || "main")}
            className="w-40"
          />
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      }
    >
      <PageContainer>
        {error ? (
          <EmptyStateCard
            title={floorErrorTitle}
            message={floorErrorMessage}
            actionLabel="Retry"
            onAction={() => void load()}
          />
        ) : null}
        <ContentGrid className="xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <DashboardPanel>
            <SectionHeader title="Floor Canvas" subtitle="Drag tables to reposition. Click a table for live dine-in controls." />
            <div
              ref={canvasRef}
              className="relative mt-3 min-h-[480px] rounded-2xl border border-border bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:16px_16px]"
            >
              {!tables.length && !loading ? (
                <div className="absolute inset-0 grid place-items-center p-4">
                  <EmptyStateCard
                    title="No tables configured"
                    message="Add the first table from the side panel to begin dine-in sessions, waiter order entry, and reservation assignment."
                    actionLabel="Focus Add Table"
                    onAction={() => document.getElementById("new-table-name")?.focus()}
                  />
                </div>
              ) : null}
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  draggable
                  onDragEnd={(event) => onTableDragEnd(table, event)}
                  onClick={() => setSelectedTableId(table.id)}
                  className={`absolute w-[130px] rounded-xl border p-2 text-left shadow-sm transition ${statusTone(table.status)} ${selectedTableId === table.id ? "ring-2 ring-primary/60" : ""}`}
                  style={{ left: table.position_x, top: table.position_y }}
                >
                  <div className="truncate text-sm font-semibold">{table.name}</div>
                  <div className="mt-1 text-[11px] text-white/80">Cap {table.capacity}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/80">
                    <span>{table.active_session ? `${table.active_session.order_ids.length} orders` : "No session"}</span>
                    <span>{table.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </DashboardPanel>

          <div className="space-y-4">
            <DashboardPanel>
              <SectionHeader title="Add Table" subtitle="Create branch tables for waiter operations." />
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input id="new-table-name" name="newTableName" placeholder="Table name" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} />
                <Input id="new-table-capacity" name="newTableCapacity" type="number" min="1" value={newTableCapacity} onChange={(e) => setNewTableCapacity(e.target.value)} />
              </div>
              <Button
                className="mt-3"
                size="sm"
                variant="primary"
                disabled={!newTableName.trim() || busy === "create_table"}
                onClick={() =>
                  void run("create_table", async () => {
                    await saveTable({
                      branchId,
                      name: newTableName,
                      capacity: Number(newTableCapacity || 4),
                      positionX: 24,
                      positionY: 24,
                      status: "available",
                    });
                    setNewTableName("");
                  })
                }
              >
                Create Table
              </Button>
            </DashboardPanel>

            <DashboardPanel>
              <SectionHeader title="Table Panel" subtitle="Selected table session, waiter assignment, and order linkage." />
              {!selectedTable ? (
                <EmptyStateCard
                  title="No table selected"
                  message="Select a table from the floor canvas to open sessions, attach orders, and update table status."
                />
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-text-primary">{selectedTable.name}</div>
                      <div className="text-xs text-white/60">Capacity {selectedTable.capacity}</div>
                    </div>
                    {tableBadge(selectedTable.status)}
                  </div>
                  {activeSession ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
                      <div>Session: {activeSession.id}</div>
                      <div>Guests: {activeSession.guest_count}</div>
                      <div>Elapsed: {activeSession.elapsed_minutes}m</div>
                      <div>Assigned waiter: {activeSession.assigned_waiter_id || "unassigned"}</div>
                      {activeSession.idle_flag ? <div className="mt-1 text-amber-300">Idle session flagged</div> : null}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <Input id="session-guest-count" name="sessionGuestCount" type="number" min="1" value={sessionGuestCount} onChange={(e) => setSessionGuestCount(e.target.value)} />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!!activeSession || busy === "open_session"}
                      onClick={() =>
                        void run("open_session", async () => {
                          await openSession({
                            branchId,
                            tableId: selectedTable.id,
                            guestCount: Number(sessionGuestCount || 2),
                          });
                        })
                      }
                    >
                      Open Session
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!activeSession || busy === "close_session"}
                      onClick={() =>
                        activeSession
                          ? void run("close_session", async () => {
                              await closeSession({
                                branchId,
                                sessionId: activeSession.id,
                                markStatus: "cleaning",
                              });
                            })
                          : undefined
                      }
                    >
                      Close Session
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={selectedTable.status !== "cleaning" || busy === "clean_done"}
                      onClick={() =>
                        void run("clean_done", async () => {
                          await markCleaningComplete({ branchId, tableId: selectedTable.id });
                        })
                      }
                    >
                      Mark Cleaning Done
                    </Button>
                  </div>
                  <ActionBar>
                    <Input
                      id="attach-order-id"
                      name="attachOrderId"
                      value={attachOrderId}
                      onChange={(e) => setAttachOrderId(e.target.value)}
                      placeholder="Attach existing order ID"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!activeSession || !attachOrderId.trim() || !canCreateOrder || busy === "attach_order"}
                      onClick={() =>
                        activeSession
                          ? void run("attach_order", async () => {
                              await attachOrder({ branchId, sessionId: activeSession.id, orderId: attachOrderId.trim() });
                              setAttachOrderId("");
                            })
                          : undefined
                      }
                    >
                      Add Order
                    </Button>
                  </ActionBar>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canUpdateService || busy === "mark_reserved"}
                      onClick={() => void run("mark_reserved", async () => {
                        await setTableStatus({ tableId: selectedTable.id, branchId, status: "reserved" });
                      })}
                    >
                      Mark Reserved
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canUpdateService || busy === "mark_available"}
                      onClick={() => void run("mark_available", async () => {
                        await setTableStatus({ tableId: selectedTable.id, branchId, status: "available" });
                      })}
                    >
                      Mark Available
                    </Button>
                  </div>
                </div>
              )}
            </DashboardPanel>
          </div>
        </ContentGrid>

        <ContentGrid className="xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <DashboardPanel>
            <SectionHeader title="Reservations" subtitle="Book and manage dine-in reservations by branch and time." />
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input id="reservation-name" name="reservationName" placeholder="Customer name" value={reservationName} onChange={(e) => setReservationName(e.target.value)} />
              <Input id="reservation-phone" name="reservationPhone" placeholder="Phone" value={reservationPhone} onChange={(e) => setReservationPhone(e.target.value)} />
              <Input id="reservation-party-size" name="reservationPartySize" type="number" min="1" value={reservationPartySize} onChange={(e) => setReservationPartySize(e.target.value)} />
              <Input id="reservation-time" name="reservationTime" type="datetime-local" value={reservationTime} onChange={(e) => setReservationTime(e.target.value)} />
              <Input id="reservation-table-id" name="reservationTableId" placeholder="Table ID (optional)" value={reservationTableId} onChange={(e) => setReservationTableId(e.target.value)} />
              <Button
                size="sm"
                variant="primary"
                disabled={!reservationName.trim() || !reservationTime || busy === "create_reservation"}
                onClick={() =>
                  void run("create_reservation", async () => {
                    await createReservation({
                      branchId,
                      customerName: reservationName,
                      phone: reservationPhone,
                      partySize: Number(reservationPartySize || 2),
                      reservationTime: new Date(reservationTime).toISOString(),
                      tableId: reservationTableId.trim() || undefined,
                    });
                    setReservationName("");
                    setReservationPhone("");
                    setReservationPartySize("2");
                    setReservationTime("");
                    setReservationTableId("");
                  })
                }
              >
                Create Reservation
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {reservations.map((reservation: FloorReservation) => (
                <div key={reservation.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text-primary">{reservation.customer_name}</div>
                    <Badge variant={reservation.status === "booked" ? "warning" : reservation.status === "arrived" ? "accent" : reservation.status === "completed" ? "success" : "neutral"}>
                      {reservation.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {new Date(reservation.reservation_time).toLocaleString()} | Party {reservation.party_size} | Table {reservation.table_id || "unassigned"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={reservation.status !== "booked" || busy === `arrive_${reservation.id}`}
                      onClick={() => void run(`arrive_${reservation.id}`, async () => {
                        await updateReservation({
                          reservationId: reservation.id,
                          branchId,
                          status: "arrived",
                        });
                      })}
                    >
                      Mark Arrived
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reservation.status === "cancelled" || busy === `cancel_${reservation.id}`}
                      onClick={() => void run(`cancel_${reservation.id}`, async () => {
                        await updateReservation({
                          reservationId: reservation.id,
                          branchId,
                          status: "cancelled",
                        });
                      })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
              {!reservations.length && !loading ? (
                <EmptyStateCard
                  title="No reservations yet"
                  message="Reservations will appear here after your host team books a dine-in slot for this branch."
                />
              ) : null}
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Live Sessions" subtitle="Realtime active/closed sessions and table-linked orders." />
            <div className="mt-3 space-y-2">
              {(snapshot?.sessions || []).map((session) => (
                <div key={session.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{session.id}</span>
                    <Badge variant={session.status === "active" ? "accent" : "neutral"}>{session.status}</Badge>
                  </div>
                  <div className="mt-1">
                    Table {session.table_id} | {session.guest_count} guests | {session.elapsed_minutes}m elapsed
                  </div>
                  <div className="mt-1">Orders: {session.order_ids.length}</div>
                  {session.idle_flag ? <div className="mt-1 text-amber-300">Idle session alert</div> : null}
                </div>
              ))}
              {!snapshot?.sessions?.length && !loading ? (
                <EmptyStateCard
                  title="No active sessions"
                  message="Open a table session when guests arrive so dine-in orders, elapsed time, and service ownership stay visible."
                />
              ) : null}
            </div>
          </DashboardPanel>
        </ContentGrid>
      </PageContainer>
    </DashboardLayout>
  );
}
