import * as React from "react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ActionBar,
  DashboardPanel,
  DataTable,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { getRestaurantProfile, type RestaurantProfile } from "../lib/restaurant";
import { addWaiter, getWaiters, setWaiterActive, updateWaiter, type Waiter } from "../lib/waiters";
import { cn } from "../lib/utils";
import { spacing, tokens } from "../design-system";

export default function StaffManagementPage() {
  const [profile] = React.useState<RestaurantProfile | null>(() => getRestaurantProfile());
  const [waiters, setWaiters] = React.useState<Waiter[]>([]);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const restaurantId = profile?.id || "";

  const reload = React.useCallback(() => {
    if (!restaurantId) return;
    setWaiters(getWaiters(restaurantId));
  }, [restaurantId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const onAddWaiter = () => {
    if (!restaurantId) return;
    setError("");
    setMessage("");
    try {
      addWaiter({ restaurantId, name, code, pin });
      setName("");
      setCode("");
      setPin("");
      reload();
      setMessage("Staff member added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add staff member.");
    }
  };

  const onToggleActive = (waiter: Waiter) => {
    if (!restaurantId) return;
    setError("");
    setMessage("");
    try {
      setWaiterActive(restaurantId, waiter.id, !waiter.active);
      reload();
      setMessage(`${waiter.name} is now ${waiter.active ? "inactive" : "active"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff status.");
    }
  };

  const onResetCode = (waiter: Waiter) => {
    if (!restaurantId) return;
    setError("");
    setMessage("");
    try {
      const nextCode = `${waiter.code}-${Math.floor(Math.random() * 90 + 10)}`;
      updateWaiter(restaurantId, waiter.id, { code: nextCode });
      reload();
      setMessage(`${waiter.name} code updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update waiter code.");
    }
  };

  return (
    <DashboardLayout
      profile={profile}
      title="Staff"
      subtitle="Manage waiters and service staff for this restaurant."
    >
      <PageContainer>
      <DashboardPanel>
        <SectionHeader title="Add Staff Member" subtitle="Create waiter access references for order-taking." />
        <ActionBar>
          <div className="grid w-full gap-2 sm:grid-cols-3">
            <Input placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} />
            <Input placeholder="Code (e.g. w01)" value={code} onChange={(event) => setCode(event.target.value)} />
            <Input
              placeholder="PIN (optional)"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              type="password"
            />
          </div>
          <Button onClick={onAddWaiter} variant="primary">Add Staff</Button>
        </ActionBar>
        {error ? <EmptyStateCard message={error} /> : null}
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      </DashboardPanel>

      <DashboardPanel>
        <SectionHeader title="Team Members" subtitle="Activate or disable staff accounts as your shifts change." />
        {!waiters.length ? (
          <EmptyStateCard message="No staff added yet. Add your first waiter above." />
        ) : (
          <DataTable className="p-2">
          <div className={spacing.stackSm}>
            {waiters.map((waiter) => (
              <div
                key={waiter.id}
                className={cn(tokens.classes.mutedPanelRow, "gap-2")}
              >
                <div>
                  <div className="font-semibold text-text-primary">{waiter.name}</div>
                  <div className="text-xs text-text-secondary/68">Code: {waiter.code}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={waiter.active ? "success" : "neutral"}>{waiter.active ? "Active" : "Inactive"}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => onToggleActive(waiter)}>
                    {waiter.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onResetCode(waiter)}>
                    Rotate Code
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </DataTable>
        )}
      </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}
