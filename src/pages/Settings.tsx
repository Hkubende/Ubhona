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
import {
  getCurrentPlan,
  getRestaurantProfile,
  getRestaurantWhatsAppSettings,
  isPaidPlan,
  updateRestaurantWhatsAppSettings,
  type RestaurantProfile,
  type RestaurantWhatsAppSettings,
} from "../lib/restaurant";
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
import { canCurrentUser, canPerformAction, getPrimaryDashboardRole, getRoleConfig } from "../lib/roles";
import { ActivityFeed } from "../components/dashboard/activity-feed";
import { ApprovalQueue } from "../components/dashboard/approval-queue";
import { getActivityHistory, getApprovals, reviewApproval, type ActivityItem, type ApprovalItem } from "../lib/activity";
import { getAutomationSettings, updateAutomationSettings, type AutomationSettings } from "../services/automation-engine";

const OPERATING_HOURS_DEFAULT = [
  { day: "Monday", open: "08:00", close: "22:00", enabled: true },
  { day: "Tuesday", open: "08:00", close: "22:00", enabled: true },
  { day: "Wednesday", open: "08:00", close: "22:00", enabled: true },
  { day: "Thursday", open: "08:00", close: "22:00", enabled: true },
  { day: "Friday", open: "08:00", close: "23:00", enabled: true },
  { day: "Saturday", open: "09:00", close: "23:00", enabled: true },
  { day: "Sunday", open: "10:00", close: "21:00", enabled: false },
] as const;

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
  const [operatingHours, setOperatingHours] = React.useState(
    OPERATING_HOURS_DEFAULT.map((entry) => ({ ...entry }))
  );
  const [whatsAppSettings, setWhatsAppSettings] = React.useState<RestaurantWhatsAppSettings>({
    enabled: false,
    directorName: "Restaurant Director",
    senderBehavior: "default",
    provider: "mock",
  });
  const [whatsAppSettingsState, setWhatsAppSettingsState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [whatsAppSettingsError, setWhatsAppSettingsError] = React.useState("");

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
  const activeRole = getPrimaryDashboardRole();
  const roleLabel = activeRole ? getRoleConfig(activeRole).label : "User";
  const canManageBilling = canPerformAction("manage_billing");
  const canManageStaff = canPerformAction("manage_staff");
  const canManagePrinting = canCurrentUser("managePrinting");
  const canManageSettings = canPerformAction("manage_settings");
  const canReviewApprovals = canManageSettings || canManageBilling;
  const [settingsHistory, setSettingsHistory] = React.useState<ActivityItem[]>([]);
  const [settingsHistoryLoading, setSettingsHistoryLoading] = React.useState(false);
  const [approvals, setApprovals] = React.useState<ApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = React.useState(false);
  const [reviewingApprovalId, setReviewingApprovalId] = React.useState<string | null>(null);
  const [automationSettings, setAutomationSettings] = React.useState<AutomationSettings | null>(null);
  const [automationSettingsState, setAutomationSettingsState] = React.useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [automationSettingsError, setAutomationSettingsError] = React.useState("");

  const currentPlan = React.useMemo(() => getCurrentPlan(profile), [profile]);
  const canDisableBrandingFooter = React.useMemo(() => isPaidPlan(profile), [profile]);
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
  const cleanRowClass = "rounded-2xl border border-border bg-card px-3 py-3";
  const cleanSplitRowClass = `${cleanRowClass} flex flex-wrap items-center justify-between gap-3 text-sm`;
  const cleanFieldClass = "space-y-1.5 text-sm";
  const cleanCheckboxClass = "h-4 w-4 rounded border border-border bg-background accent-[var(--color-primary)]";
  const cleanInputClass = "!bg-background !shadow-none";
  const cleanSelectTriggerClass =
    "!min-h-11 !bg-card !shadow-none hover:!bg-card focus-visible:!ring-primary/45";
  const cleanSelectContentClass = "!bg-card !shadow-none backdrop-blur-none";

  React.useEffect(() => {
    let mounted = true;
    void getRestaurantWhatsAppSettings()
      .then((settings) => {
        if (mounted) setWhatsAppSettings(settings);
      })
      .catch(() => {
        if (!mounted) return;
        setWhatsAppSettingsError("WhatsApp setup is not available in this environment yet. Finish the rest of restaurant setup now, then return when live messaging credentials are ready.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const patchWhatsAppSettings = async (patch: Partial<RestaurantWhatsAppSettings>) => {
    setWhatsAppSettings((prev) => ({ ...prev, ...patch }));
    setWhatsAppSettingsState("saving");
    setWhatsAppSettingsError("");
    try {
      const updated = await updateRestaurantWhatsAppSettings({
        enabled: patch.enabled,
        directorName: patch.directorName,
        senderBehavior: patch.senderBehavior,
        provider: patch.provider,
      });
      setWhatsAppSettings(updated);
      setWhatsAppSettingsState("saved");
      window.setTimeout(() => setWhatsAppSettingsState((current) => (current === "saved" ? "idle" : current)), 1200);
    } catch (error) {
      setWhatsAppSettingsState("error");
      setWhatsAppSettingsError(error instanceof Error ? error.message : "Failed to save WhatsApp settings.");
    }
  };

  const refreshAuditPanels = React.useCallback(() => {
    setSettingsHistoryLoading(true);
    setApprovalsLoading(true);
    void getActivityHistory({ limit: 8 })
      .then((rows) => {
        setSettingsHistory(rows.filter((row) => row.action.includes("settings")));
      })
      .catch(() => setSettingsHistory([]))
      .finally(() => setSettingsHistoryLoading(false));
    void getApprovals("pending")
      .then((rows) => setApprovals(rows))
      .catch(() => setApprovals([]))
      .finally(() => setApprovalsLoading(false));
  }, []);

  React.useEffect(() => {
    refreshAuditPanels();
  }, [refreshAuditPanels]);

  React.useEffect(() => {
    let mounted = true;
    void getAutomationSettings()
      .then((settings) => {
        if (mounted) setAutomationSettings(settings);
      })
      .catch(() => {
        if (mounted) setAutomationSettings(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const patchAutomationSettings = async (patch: Partial<AutomationSettings>) => {
    if (!automationSettings) return;
    const optimistic = { ...automationSettings, ...patch };
    setAutomationSettings(optimistic);
    setAutomationSettingsState("saving");
    setAutomationSettingsError("");
    try {
      const saved = await updateAutomationSettings(patch);
      setAutomationSettings(saved);
      setAutomationSettingsState("saved");
      window.setTimeout(() => {
        setAutomationSettingsState((value) => (value === "saved" ? "idle" : value));
      }, 1200);
      refreshAuditPanels();
    } catch (error) {
      setAutomationSettingsState("error");
      setAutomationSettingsError(error instanceof Error ? error.message : "Failed to save automation settings.");
    }
  };

  const handleReviewApproval = async (approvalId: string, decision: "approved" | "rejected") => {
    setReviewingApprovalId(approvalId);
    try {
      await reviewApproval(approvalId, decision);
      refreshAuditPanels();
    } catch (error) {
      setWaiterMessage(error instanceof Error ? error.message : "Failed to review approval.");
    } finally {
      setReviewingApprovalId(null);
    }
  };

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
            <div className={fieldRowClass}>Role: {roleLabel}</div>
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
          <SectionHeader title="Operating Hours" subtitle="Configure storefront visibility windows by day." />
          <div className={cn(spacing.stackSm, "text-sm")}>
            {operatingHours.map((row, index) => (
              <div key={row.day} className={cn(cleanRowClass, "grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center")}>
                <div className="self-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {row.day}
                </div>
                <Input
                  id={`hours-open-${row.day}`}
                  name={`hoursOpen${row.day}`}
                  type="time"
                  className={cleanInputClass}
                  value={row.open}
                  onChange={(event) =>
                    setOperatingHours((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, open: event.target.value } : entry
                      )
                    )
                  }
                  disabled={!row.enabled}
                />
                <Input
                  id={`hours-close-${row.day}`}
                  name={`hoursClose${row.day}`}
                  type="time"
                  className={cleanInputClass}
                  value={row.close}
                  onChange={(event) =>
                    setOperatingHours((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, close: event.target.value } : entry
                      )
                    )
                  }
                  disabled={!row.enabled}
                />
                <label className="inline-flex items-center gap-2 px-1 py-2 text-xs font-semibold text-muted-foreground">
                  Open
                  <input
                    id={`hours-enabled-${row.day}`}
                    name={`hoursEnabled${row.day}`}
                    type="checkbox"
                    className={cleanCheckboxClass}
                    checked={row.enabled}
                    onChange={(event) =>
                      setOperatingHours((current) =>
                        current.map((entry, currentIndex) =>
                          currentIndex === index ? { ...entry, enabled: event.target.checked } : entry
                        )
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Notifications" subtitle="Order, payment, and activity alerts." />
          <div className={cn(spacing.stackSm, "text-sm")}>
            <div className="rounded-xl border border-border bg-card px-3 py-3 text-xs text-text-secondary/78">
              WhatsApp alerts are setup-dependent. Orders can still run normally without them. Messaging becomes live only after a supported provider is connected and approved for this restaurant.
            </div>
            <label className={cleanSplitRowClass}>
              <span className="text-foreground">Email notifications</span>
              <input className={cleanCheckboxClass} id="settings-email-notifications" name="emailNotifications" type="checkbox" defaultChecked />
            </label>
            <label className={cleanSplitRowClass}>
              <span className="text-foreground">SMS order alerts</span>
              <input className={cleanCheckboxClass} id="settings-sms-alerts" name="smsOrderAlerts" type="checkbox" defaultChecked />
            </label>
            <label className={cleanSplitRowClass}>
              <span className="text-foreground">WhatsApp order notifications</span>
              <input
                id="settings-whatsapp-enabled"
                name="whatsappEnabled"
                type="checkbox"
                className={cleanCheckboxClass}
                checked={whatsAppSettings.enabled}
                onChange={(event) => {
                  void patchWhatsAppSettings({ enabled: event.target.checked });
                }}
              />
            </label>
            <label className={cleanFieldClass}>
              <div className={typography.label}>Director Name</div>
              <Input
                id="settings-whatsapp-director-name"
                name="whatsappDirectorName"
                className={cleanInputClass}
                value={whatsAppSettings.directorName}
                onChange={(event) => setWhatsAppSettings((prev) => ({ ...prev, directorName: event.target.value }))}
                onBlur={() => {
                  void patchWhatsAppSettings({ directorName: whatsAppSettings.directorName });
                }}
                placeholder="Restaurant Director"
              />
            </label>
            <label className={cleanFieldClass}>
              <div className={typography.label}>Sender Behavior</div>
              <UbhonaSelect
                name="whatsappSenderBehavior"
                value={whatsAppSettings.senderBehavior}
                triggerClassName={cleanSelectTriggerClass}
                contentClassName={cleanSelectContentClass}
                onValueChange={(value) => {
                  void patchWhatsAppSettings({ senderBehavior: value as "default" | "restaurant" });
                }}
              >
                <UbhonaSelectItem value="default">Default Sender</UbhonaSelectItem>
                <UbhonaSelectItem value="restaurant">Restaurant Branded Sender</UbhonaSelectItem>
              </UbhonaSelect>
            </label>
            <label className={cleanFieldClass}>
              <div className={typography.label}>Provider</div>
              <UbhonaSelect
                name="whatsappProvider"
                value={whatsAppSettings.provider}
                triggerClassName={cleanSelectTriggerClass}
                contentClassName={cleanSelectContentClass}
                onValueChange={(value) => {
                  void patchWhatsAppSettings({ provider: value as "mock" | "meta_cloud" | "twilio" });
                }}
              >
                <UbhonaSelectItem value="mock">Mock (Development)</UbhonaSelectItem>
                <UbhonaSelectItem value="meta_cloud">Meta Cloud API</UbhonaSelectItem>
                <UbhonaSelectItem value="twilio">Twilio WhatsApp</UbhonaSelectItem>
              </UbhonaSelect>
            </label>
            {whatsAppSettingsState === "saving" ? (
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
                Saving WhatsApp settings...
              </div>
            ) : null}
            {whatsAppSettingsState === "saved" ? (
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                WhatsApp configuration saved. Messaging remains inactive until live provider credentials and approval are in place.
              </div>
            ) : null}
            {whatsAppSettingsError ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {whatsAppSettingsError}
              </div>
            ) : null}
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
        {canManageBilling ? (
        <DashboardPanel>
          <SectionHeader title="Plan & Feature Access" subtitle="SaaS plan foundations and feature gating readiness." />
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="accent" className="px-3 py-1">{currentPlan.label}</Badge>
            <Badge variant="neutral" className="px-3 py-1">{currentPlan.status}</Badge>
            <span className="text-text-secondary/68">Plan and feature access are controlled by backend billing state.</span>
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
                  <div className="mt-1 text-xs text-amber-100/80">
                    Locked on {feature.currentPlanLabel}. Upgrade to {feature.minimumPlanLabel} to unlock.
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </DashboardPanel>
        ) : null}
        {canManagePrinting ? (
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
                disabled={!canDisableBrandingFooter}
                onChange={(event) => savePrinterPatch({ showBrandingFooter: event.target.checked })}
              />
            </label>
            {!canDisableBrandingFooter ? (
              <div className="md:col-span-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Starter requires the &quot;Powered by Ubhona&quot; footer. Upgrade to Growth or Pro to remove it.
              </div>
            ) : null}
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
        ) : null}
        {(canManageSettings || canManagePrinting) && automationSettings ? (
          <DashboardPanel>
            <SectionHeader
              title="Automation Rules"
              subtitle="Event-driven automations for printing, messaging, overdue handling, and operational reliability."
            />
            <div className="grid gap-2 md:grid-cols-2">
              <label className={toggleRowClass}>
                <span>Auto print kitchen tickets</span>
                <input
                  id="settings-auto-print-kitchen-tickets"
                  name="autoPrintKitchenTickets"
                  type="checkbox"
                  checked={automationSettings.auto_print_kitchen_tickets}
                  onChange={(event) => {
                    void patchAutomationSettings({ auto_print_kitchen_tickets: event.target.checked });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <span>Auto print receipts on payment complete</span>
                <input
                  id="settings-auto-print-receipts"
                  name="autoPrintReceipts"
                  type="checkbox"
                  checked={automationSettings.auto_print_receipts}
                  onChange={(event) => {
                    void patchAutomationSettings({ auto_print_receipts: event.target.checked });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <span>WhatsApp status updates</span>
                <input
                  id="settings-automation-whatsapp-status"
                  name="automationWhatsappStatusUpdates"
                  type="checkbox"
                  checked={automationSettings.whatsapp_status_updates_enabled}
                  onChange={(event) => {
                    void patchAutomationSettings({ whatsapp_status_updates_enabled: event.target.checked });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <span>Director thank-you on completion</span>
                <input
                  id="settings-automation-director-thankyou"
                  name="automationDirectorThankYou"
                  type="checkbox"
                  checked={automationSettings.director_thank_you_enabled}
                  onChange={(event) => {
                    void patchAutomationSettings({ director_thank_you_enabled: event.target.checked });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <span>Notify manager when overdue</span>
                <input
                  id="settings-automation-notify-overdue"
                  name="automationNotifyOverdue"
                  type="checkbox"
                  checked={automationSettings.notify_manager_on_overdue}
                  onChange={(event) => {
                    void patchAutomationSettings({ notify_manager_on_overdue: event.target.checked });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <span>Auto-hide unavailable dishes on low stock</span>
                <input
                  id="settings-automation-auto-hide-unavailable"
                  name="automationAutoHideUnavailable"
                  type="checkbox"
                  checked={automationSettings.auto_hide_unavailable_dishes}
                  onChange={(event) => {
                    void patchAutomationSettings({ auto_hide_unavailable_dishes: event.target.checked });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <span>Print on order created</span>
                <input
                  id="settings-automation-print-order-created"
                  name="automationPrintOnOrderCreated"
                  type="checkbox"
                  checked={automationSettings.print_on_order_created}
                  onChange={(event) => {
                    void patchAutomationSettings({ print_on_order_created: event.target.checked });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <span>Print on order confirmed</span>
                <input
                  id="settings-automation-print-order-confirmed"
                  name="automationPrintOnOrderConfirmed"
                  type="checkbox"
                  checked={automationSettings.print_on_order_confirmed}
                  onChange={(event) => {
                    void patchAutomationSettings({ print_on_order_confirmed: event.target.checked });
                  }}
                />
              </label>
            </div>
            <div className="mt-3 grid gap-2 md:max-w-xs">
              <label className={selectFieldClass}>
                <div className={cn("mb-1", typography.label)}>Overdue Threshold (minutes)</div>
                <Input
                  id="settings-overdue-threshold"
                  name="overdueThresholdMinutes"
                  type="number"
                  min={5}
                  max={240}
                  step={1}
                  value={String(automationSettings.overdue_threshold_minutes)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setAutomationSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            overdue_threshold_minutes: Number.isFinite(next) ? Math.max(5, Math.min(240, next)) : 20,
                          }
                        : prev
                    );
                  }}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    void patchAutomationSettings({
                      overdue_threshold_minutes: Number.isFinite(next) ? Math.max(5, Math.min(240, next)) : 20,
                    });
                  }}
                />
              </label>
            </div>
            {automationSettingsState === "saving" ? (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
                Saving automation settings...
              </div>
            ) : null}
            {automationSettingsState === "saved" ? (
              <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                Automation settings saved.
              </div>
            ) : null}
            {automationSettingsError ? (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {automationSettingsError}
              </div>
            ) : null}
          </DashboardPanel>
        ) : null}
        {canManageStaff ? (
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
        ) : null}
        <ContentGrid columns="two">
          <ActivityFeed
            title="Settings History"
            subtitle="Track who changed operational configuration."
            items={settingsHistory}
            loading={settingsHistoryLoading}
            emptyMessage="No settings changes recorded yet."
          />
          <ApprovalQueue
            items={approvals}
            loading={approvalsLoading}
            canReview={canReviewApprovals}
            reviewingId={reviewingApprovalId}
            onReview={handleReviewApproval}
          />
        </ContentGrid>
      </PageContainer>
    </DashboardLayout>
  );
}
