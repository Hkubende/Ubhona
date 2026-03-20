export type BluetoothPrinterInfo = {
  id: string;
  name: string;
  connectedAt: string;
  connectionType: "web-bluetooth" | "bridge-placeholder";
};

export type BluetoothSendResult = {
  accepted: boolean;
  delivered: boolean;
  message: string;
};

const BLUETOOTH_PRINTER_KEY = "ubhona_bluetooth_printer_v1";
const SHOULD_LOG_INFO = import.meta.env.DEV;

function getStoredBluetoothPrinter(): BluetoothPrinterInfo | null {
  try {
    const raw = localStorage.getItem(BLUETOOTH_PRINTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BluetoothPrinterInfo>;
    if (!parsed.id || !parsed.name || !parsed.connectedAt) return null;
    return {
      id: String(parsed.id),
      name: String(parsed.name),
      connectedAt: String(parsed.connectedAt),
      connectionType: parsed.connectionType === "web-bluetooth" ? "web-bluetooth" : "bridge-placeholder",
    };
  } catch {
    return null;
  }
}

function setStoredBluetoothPrinter(info: BluetoothPrinterInfo | null) {
  if (!info) {
    localStorage.removeItem(BLUETOOTH_PRINTER_KEY);
    return;
  }
  localStorage.setItem(BLUETOOTH_PRINTER_KEY, JSON.stringify(info));
}

export async function connectBluetoothPrinter() {
  if (typeof navigator !== "undefined" && "bluetooth" in navigator) {
    const api = (navigator as Navigator & {
      bluetooth?: {
        requestDevice: (options: BluetoothRequestDeviceOptions) => Promise<BluetoothDevice>;
      };
    }).bluetooth;

    if (!api?.requestDevice) {
      throw new Error("Web Bluetooth API is present but requestDevice is unavailable.");
    }

    const device = await api.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["generic_access", "device_information"],
    });

    const info: BluetoothPrinterInfo = {
      id: device.id || `bt-${Date.now()}`,
      name: device.name || "Bluetooth Thermal Printer",
      connectedAt: new Date().toISOString(),
      connectionType: "web-bluetooth",
    };
    setStoredBluetoothPrinter(info);
    return info;
  }

  throw new Error("Bluetooth printing is unavailable in this browser. Use browser print fallback or ESC/POS preview.");
}

export function disconnectBluetoothPrinter() {
  setStoredBluetoothPrinter(null);
}

export function isBluetoothPrinterConnected() {
  return Boolean(getStoredBluetoothPrinter());
}

export function getBluetoothPrinterConnection() {
  return getStoredBluetoothPrinter();
}

export async function sendToBluetoothPrinter(payload: string[]): Promise<BluetoothSendResult> {
  const printer = getStoredBluetoothPrinter();
  if (!printer) {
    return {
      accepted: false,
      delivered: false,
      message: "No connected Bluetooth printer.",
    };
  }

  if (SHOULD_LOG_INFO) {
    // TODO: Replace preview delivery with real GATT/WebUSB/bridge transport write.
    // eslint-disable-next-line no-console
    console.info(`[BLUETOOTH PRINTER PREVIEW] ${printer.name}\n${payload.join("\n")}`);
  }

  return {
    accepted: true,
    delivered: false,
    message: "Printer is paired, but direct Bluetooth ESC/POS transport is not implemented yet.",
  };
}
