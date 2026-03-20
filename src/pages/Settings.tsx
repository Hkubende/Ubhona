import * as React from "react";
import { Check, Lock } from "lucide-react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ContentGrid,
  DashboardPanel,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { UbhonaSelect, UbhonaSelectItem } from "../components/ui/ubhona-select";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import { getCurrentPlan, getRestaurantProfile, type RestaurantProfile } from "../lib/restaurant";
import { getPlanFeatureSummary } from "../lib/plan-gates";
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothPrinterConnection,
  getPrinterSettings,
  isBluetoothPrinterConnected,
  updatePrinterSettings,
  type PrintMode,
  type PrinterTransport,
  type PrinterSettings,
} from "../lib/print";
import {
  addWaiter,
  getWaiters,
  setWaiterActive,
  updateWaiter,
  type Waiter,
} from "../lib/waiters";
import { cn } from "../lib/utils";
import { spacing, tokens, typography } from "../design-system";

export default function Settings() {
  const { data } = useRestaurantDashboard();
  const persistedProfile = React.useMemo(() => getRestaurantProfile(), []);
  const [printerSettings, setPrinterSettings] = React.useState<PrinterSettings>(() => getPrinterSettings());
  const [bluetoothState, setBluetoothState] = React.useState(() => getBluetoothPrinterConnection());
  const [printerMessage, setPrinterMessage] = React.useState("");
  const [connectingPrinter, setConnectingPrinter] = React.useState(false);
  const [waiters, setWaiters] = React.useState<Waiter[]>([]);
  const [waiterMessage, setWaiterMessage] = React.useState("");
  const [newWaiterName, setNewWaiterName] = React.useState("");
  const [newWaiterCode, setNewWaiterCode] = React.useState("");
  const [newWaiterPin, setNewWaiterPin] = React.useState("");

  const profile = React.useMemo<RestaurantProfile | null>(() => {
    if (!data) return null;
    const fallbackPlan = persistedProfile?.subscriptionPlan || "starter";
    const fallbackStatus = persistedProfile?.subscriptionStatus || "active";
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
      subscriptionPlan: data.restaurant.subscriptionPlan || fallbackPlan,
      subscriptionStatus: data.restaurant.subscriptionStatus || fallbackStatus,
      trialEndsAt: persistedProfile?.trialEndsAt || null,
      renewalDate: persistedProfile?.renewalDate || null,
      createdAt: persistedProfile?.createdAt || new Date().toISOString(),
    };
  }, [data, persistedProfile]);

  const currentPlan = React.useMemo(() => getCurrentPlan(profile), [profile]);
  const planFeatures = React.useMemo(() => getPlanFeatureSummary(profile), [profile]);
  const savePrinterPatch = (patch: Partial<PrinterSettings>) => {
    const next = updatePrinterSettings(patch);
    setPrinterSettings(next);
  };
  const connectPrinter = async () => {
    setPrinterMessage("");
    setConnectingPrinter(true);
    try {
      const connection = await connectBluetoothPrinter();
      setBluetoothState(connection);
      setPrinterMessage(`Connected to ${connection.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect printer.";
      setPrinterMessage(message);
    } finally {
      setConnectingPrinter(false);
    }
  };
  const disconnectPrinter = () => {
    disconnectBluetoothPrinter();
    setBluetoothState(null);
    setPrinterMessage("Bluetooth printer disconnected.");
  };

  React.useEffect(() => {
    if (!data?.restaurant.id) return;
    setWaiters(getWaiters(data.restaurant.id));
  }, [data?.restaurant.id]);

  const refreshWaiters = React.useCallback(() => {
    if (!data?.restaurant.id) return;
    setWaiters(getWaiters(data.restaurant.id));
  }, [data?.restaurant.id]);

  const createWaiterRow = () => {
    if (!data?.restaurant.id) return;
    setWaiterMessage("");
    try {
      addWaiter({
        restaurantId: data.restaurant.id,
        name: newWaiterName,
        code: newWaiterCode,
        pin: newWaiterPin,
      });
      setNewWaiterName("");
      setNewWaiterCode("");
      setNewWaiterPin("");
      refreshWaiters();
      setWaiterMessage("Waiter added.");
    } catch (error) {
      setWaiterMessage(error instanceof Error ? error.message : "Failed to add waiter.");
    }
  };

  const updateWaiterField = (waiterId: string, patch: Partial<Pick<Waiter, "name" | "code" | "pin" | "active">>) => {
    if (!data?.restaurant.id) return;
    try {
      updateWaiter(data.restaurant.id, waiterId, patch);
      refreshWaiters();
    } catch (error) {
      setWaiterMessage(error instanceof Error ? error.message : "Failed to update waiter.");
    }
  };

  const fieldRowClass = tokens.classes.mutedPanelRow;
  const toggleRowClass = cn(tokens.classes.mutedPanelRow, "text-sm");
  const selectFieldClass = cn(tokens.classes.panelInset, "text-sm");

  return (
    <DashboardLayout
      profile={profile}
      title="Settings"
      subtitle="Configure account, restaurant profile, notifications, and preferences."
    >
      <PageContainer>
        <ContentGrid columns="two">
        <DashboardPanel>
          <SectionHeader title="Account" subtitle="Owner account and access controls." />
          <div className={cn(spacing.stackSm, "text-sm text-text-secondary/82")}>
            <div className={fieldRowClass}>Email: {data?.restaurant.email || "not-set"}</div>
            <div className={fieldRowClass}>Phone: {data?.restaurant.phone || "not-set"}</div>
            <div className={fieldRowClass}>Role: Restaurant Owner</div>
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Restaurant Profile" subtitle="Core restaurant details." />
          <div className={cn(spacing.stackSm, "text-sm text-text-secondary/82")}>
            <div className={fieldRowClass}>Name: {data?.restaurant.name || "not-set"}</div>
            <div className={fieldRowClass}>Slug: {data?.restaurant.slug || "not-set"}</div>
            <div className={fieldRowClass}>Location: {data?.restaurant.location || "not-set"}</div>
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Notifications" subtitle="Order, payment, and activity alerts." />
          <div className={cn(spacing.stackSm, "text-sm")}>
            <label className={toggleRowClass}>
              <span>Email notifications</span>
              <input id="settings-email-notifications" name="emailNotifications" type="checkbox" defaultChecked />
            </label>
            <label className={toggleRowClass}>
              <span>SMS order alerts</span>
              <input id="settings-sms-alerts" name="smsOrderAlerts" type="checkbox" defaultChecked />
            </label>
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Preferences" subtitle="Regional and dashboard preferences." />
          <div className={cn(spacing.stackSm, "text-sm text-text-secondary/82")}>
            <div className={fieldRowClass}>Currency: KSh</div>
            <div className={fieldRowClass}>Timezone: Africa/Nairobi</div>
            <div className={fieldRowClass}>Language: English</div>
          </div>
        </DashboardPanel>
        </ContentGrid>
        <DashboardPanel>
          <SectionHeader title="Plan & Feature Access" subtitle="SaaS plan foundations and feature gating readiness." />
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="accent" className="px-3 py-1">{currentPlan.label}</Badge>
            <Badge variant="neutral" className="px-3 py-1">{currentPlan.status}</Badge>
            <span className="text-text-secondary/68">Use `/pricing` to change plan when billing is connected.</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {planFeatures.map((feature) => (
              <div
                key={feature.feature}
                className={`rounded-2xl border px-3 py-2 text-sm ${
                  feature.enabled
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : "border-amber-400/20 bg-amber-500/8 text-amber-100"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {feature.enabled ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {feature.label}
                </div>
                {!feature.enabled ? (
                  <div className="mt-1 text-xs text-amber-100/80">Requires {feature.minimumPlanLabel}</div>
                ) : null}
              </div>
            ))}
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Printer Settings" subtitle="Thermal printing foundation with browser fallback and ESC/POS preview mode." />
          <div className="grid gap-3 md:grid-cols-2">
            <label className={selectFieldClass}>
              <div className={cn("mb-1", typography.label)}>Print Mode</div>
              <UbhonaSelect
                name="printMode"
                value={printerSettings.printMode}
                onValueChange={(value) => savePrinterPatch({ printMode: value as PrintMode })}
              >
                <UbhonaSelectItem value="manual">Manual</UbhonaSelectItem>
                <UbhonaSelectItem value="auto">Auto</UbhonaSelectItem>
              </UbhonaSelect>
            </label>
            <label className={selectFieldClass}>
              <div className={cn("mb-1", typography.label)}>Printer Transport</div>
              <UbhonaSelect
                name="printerTransport"
                value={printerSettings.printerTransport}
                onValueChange={(value) =>
                  savePrinterPatch({ printerTransport: value as PrinterTransport })
                }
              >
                <UbhonaSelectItem value="browser">Browser Print</UbhonaSelectItem>
                <UbhonaSelectItem value="bluetooth">Bluetooth Thermal Printer</UbhonaSelectItem>
                <UbhonaSelectItem value="escpos-preview">ESC/POS Preview</UbhonaSelectItem>
              </UbhonaSelect>
            </label>
            <label className={selectFieldClass}>
              <div className={cn("mb-1", typography.label)}>Paper Width</div>
              <UbhonaSelect
                name="paperWidth"
                value={printerSettings.paperWidth}
                onValueChange={(value) => savePrinterPatch({ paperWidth: value as "80mm" | "58mm" })}
              >
                <UbhonaSelectItem value="80mm">80mm</UbhonaSelectItem>
                <UbhonaSelectItem value="58mm">58mm</UbhonaSelectItem>
              </UbhonaSelect>
            </label>
            <label className={toggleRowClass}>
              <span>Show branding footer</span>
              <input
                id="settings-show-branding-footer"
                name="showBrandingFooter"
                type="checkbox"
                checked={printerSettings.showBrandingFooter}
                onChange={(event) => savePrinterPatch({ showBrandingFooter: event.target.checked })}
              />
            </label>
            <label className={toggleRowClass}>
              <span>Auto print customer receipt on order</span>
              <input
                id="settings-auto-customer-receipt"
                name="autoPrintCustomerReceiptOnOrder"
                type="checkbox"
                checked={printerSettings.autoPrintCustomerReceiptOnOrder}
                onChange={(event) => savePrinterPatch({ autoPrintCustomerReceiptOnOrder: event.target.checked })}
              />
            </label>
            <label className={cn(toggleRowClass, "md:col-span-2")}>
              <span>Auto print kitchen ticket on new order</span>
              <input
                id="settings-auto-kitchen-ticket"
                name="autoPrintKitchenTicketOnOrder"
                type="checkbox"
                checked={printerSettings.autoPrintKitchenTicketOnOrder}
                onChange={(event) => savePrinterPatch({ autoPrintKitchenTicketOnOrder: event.target.checked })}
              />
            </label>
            <label className={cn(toggleRowClass, "md:col-span-2")}>
              <span>Auto print payment receipt on payment</span>
              <input
                id="settings-auto-payment-receipt"
                name="autoPrintPaymentReceiptOnPayment"
                type="checkbox"
                checked={printerSettings.autoPrintPaymentReceiptOnPayment}
                onChange={(event) => savePrinterPatch({ autoPrintPaymentReceiptOnPayment: event.target.checked })}
              />
            </label>
            <div className={cn(tokens.classes.panelInset, "px-3 py-3 text-sm md:col-span-2")}>
              <div className={cn("mb-2", typography.label)}>Bluetooth Printer</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => void connectPrinter()}
                  disabled={connectingPrinter}
                  variant="secondary"
                  size="sm"
                >
                  {connectingPrinter ? "Connecting..." : "Connect Bluetooth Printer"}
                </Button>
                <Button
                  onClick={disconnectPrinter}
                  variant="outline"
                  size="sm"
                >
                  Disconnect Printer
                </Button>
                <span className="text-xs text-text-secondary/70">
                  Status: {isBluetoothPrinterConnected() ? `Connected (${bluetoothState?.name || "Printer"})` : "Not connected"}
                </span>
              </div>
              {printerMessage ? <p className="mt-2 text-xs text-text-secondary/70">{printerMessage}</p> : null}
            </div>
          </div>
          <p className="mt-2 text-xs text-text-secondary/68">
            Manual mode prints only on click. Auto mode prints on enabled lifecycle events using your selected transport, with browser fallback.
          </p>
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Waiter Management" subtitle="Create and maintain restaurant waiter identities for admin-side order entry." />
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              id="new-waiter-name"
              name="newWaiterName"
              value={newWaiterName}
              onChange={(event) => setNewWaiterName(event.target.value)}
              placeholder="Waiter name"
            />
            <Input
              id="new-waiter-code"
              name="newWaiterCode"
              value={newWaiterCode}
              onChange={(event) => setNewWaiterCode(event.target.value)}
              placeholder="Waiter code"
            />
            <Input
              id="new-waiter-pin"
              name="newWaiterPin"
              value={newWaiterPin}
              onChange={(event) => setNewWaiterPin(event.target.value)}
              placeholder="PIN (optional)"
            />
            <Button
              onClick={createWaiterRow}
              variant="primary"
            >
              Add Waiter
            </Button>
          </div>
          <div className={cn("mt-3", spacing.stackSm)}>
            {waiters.map((waiter) => (
              <div key={waiter.id} className={cn(tokens.classes.panelInset, "grid gap-2 p-3 md:grid-cols-[1fr_1fr_1fr_auto]")}>
                <Input
                  id={`waiter-name-${waiter.id}`}
                  name={`waiterName-${waiter.id}`}
                  value={waiter.name}
                  onChange={(event) => updateWaiterField(waiter.id, { name: event.target.value })}
                />
                <Input
                  id={`waiter-code-${waiter.id}`}
                  name={`waiterCode-${waiter.id}`}
                  value={waiter.code}
                  onChange={(event) => updateWaiterField(waiter.id, { code: event.target.value })}
                />
                <Input
                  id={`waiter-pin-${waiter.id}`}
                  name={`waiterPin-${waiter.id}`}
                  value={waiter.pin || ""}
                  onChange={(event) => updateWaiterField(waiter.id, { pin: event.target.value })}
                  placeholder="PIN"
                />
                <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-text-secondary/82">
                  Active
                  <input
                    id={`waiter-active-${waiter.id}`}
                    name={`waiterActive-${waiter.id}`}
                    type="checkbox"
                    checked={waiter.active}
                    onChange={(event) => {
                      setWaiterActive(waiter.restaurantId, waiter.id, event.target.checked);
                      refreshWaiters();
                    }}
                  />
                </label>
              </div>
            ))}
            {!waiters.length ? (
              <div className="rounded-2xl border border-dashed border-border bg-background/30 p-3 text-sm text-text-secondary/68">
                No waiters configured yet.
              </div>
            ) : null}
          </div>
          {waiterMessage ? <p className="mt-2 text-xs text-text-secondary/70">{waiterMessage}</p> : null}
        </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}
