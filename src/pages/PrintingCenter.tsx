import * as React from "react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ActionBar,
  ContentGrid,
  DashboardPanel,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { UbhonaSelect, UbhonaSelectItem } from "../components/ui/ubhona-select";
import { getRestaurantProfile, type RestaurantProfile } from "../lib/restaurant";
import { type PrinterSettings, getPrinterSettings, savePrinterSettings } from "../lib/print/printer-settings";
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothPrinterConnection,
} from "../lib/print/bluetooth";
import { cn } from "../lib/utils";
import { tokens, typography } from "../design-system";

export default function PrintingCenterPage() {
  const [profile] = React.useState<RestaurantProfile | null>(() => getRestaurantProfile());
  const [settings, setSettings] = React.useState<PrinterSettings>(() => getPrinterSettings());
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [bluetoothName, setBluetoothName] = React.useState<string | null>(() => getBluetoothPrinterConnection()?.name || null);

  const save = () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      savePrinterSettings(settings);
      setMessage("Printing preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save printer settings.");
    } finally {
      setSaving(false);
    }
  };

  const connect = async () => {
    setError("");
    setMessage("");
    try {
      const info = await connectBluetoothPrinter();
      setBluetoothName(info.name);
      setMessage(`Connected to ${info.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect printer.");
    }
  };

  const disconnect = () => {
    disconnectBluetoothPrinter();
    setBluetoothName(null);
    setMessage("Bluetooth printer disconnected.");
  };

  return (
    <DashboardLayout
      profile={profile}
      title="Printing"
      subtitle="Control ticket and receipt output for your restaurant operations."
    >
      <PageContainer>
      <DashboardPanel>
        <SectionHeader title="Printer Mode" subtitle="Choose how your print jobs are handled." />
        <ContentGrid columns="three">
          <label className="text-sm text-text-secondary/82">
            <div className={cn("mb-1", typography.label)}>Print Mode</div>
            <UbhonaSelect
              id="print-mode"
              name="printMode"
              value={settings.printMode}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, printMode: value as PrinterSettings["printMode"] }))
              }
              className="mt-1"
            >
              <UbhonaSelectItem value="manual">Manual</UbhonaSelectItem>
              <UbhonaSelectItem value="auto">Auto</UbhonaSelectItem>
            </UbhonaSelect>
          </label>
          <label className="text-sm text-text-secondary/82">
            <div className={cn("mb-1", typography.label)}>Transport</div>
            <UbhonaSelect
              id="printer-transport"
              name="printerTransport"
              value={settings.printerTransport}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, printerTransport: value as PrinterSettings["printerTransport"] }))
              }
              className="mt-1"
            >
              <UbhonaSelectItem value="browser">Browser Print</UbhonaSelectItem>
              <UbhonaSelectItem value="bluetooth">Bluetooth Thermal</UbhonaSelectItem>
              <UbhonaSelectItem value="escpos-preview">ESC/POS Preview</UbhonaSelectItem>
            </UbhonaSelect>
          </label>
          <label className="text-sm text-text-secondary/82">
            <div className={cn("mb-1", typography.label)}>Paper Width</div>
            <UbhonaSelect
              id="paper-width"
              name="paperWidth"
              value={settings.paperWidth}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, paperWidth: value as PrinterSettings["paperWidth"] }))
              }
              className="mt-1"
            >
              <UbhonaSelectItem value="80mm">80mm</UbhonaSelectItem>
              <UbhonaSelectItem value="58mm">58mm</UbhonaSelectItem>
            </UbhonaSelect>
          </label>
        </ContentGrid>
        <ActionBar className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={bluetoothName ? "success" : "neutral"}>
              {bluetoothName ? `Connected: ${bluetoothName}` : "No Bluetooth Printer"}
            </Badge>
            <Button size="sm" variant="secondary" onClick={() => void connect()}>
              Connect Printer
            </Button>
            <Button size="sm" variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </ActionBar>
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </DashboardPanel>

      <DashboardPanel>
        <SectionHeader title="Auto Print Rules" subtitle="Configure automatic print triggers for core order events." />
        <div className="grid gap-2 text-sm text-text-secondary/82">
          <label className={tokens.classes.mutedPanelRow}>
            <span>Auto print kitchen ticket on new order</span>
            <input
              name="autoPrintKitchenTicketOnOrder"
              type="checkbox"
              checked={settings.autoPrintKitchenTicketOnOrder}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, autoPrintKitchenTicketOnOrder: event.target.checked }))
              }
            />
          </label>
          <label className={tokens.classes.mutedPanelRow}>
            <span>Auto print customer receipt on order</span>
            <input
              name="autoPrintCustomerReceiptOnOrder"
              type="checkbox"
              checked={settings.autoPrintCustomerReceiptOnOrder}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, autoPrintCustomerReceiptOnOrder: event.target.checked }))
              }
            />
          </label>
          <label className={tokens.classes.mutedPanelRow}>
            <span>Auto print payment receipt on payment</span>
            <input
              name="autoPrintPaymentReceiptOnPayment"
              type="checkbox"
              checked={settings.autoPrintPaymentReceiptOnPayment}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, autoPrintPaymentReceiptOnPayment: event.target.checked }))
              }
            />
          </label>
        </div>
      </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}
