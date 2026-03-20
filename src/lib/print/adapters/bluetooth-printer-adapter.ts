import { sendToBluetoothPrinter } from "../bluetooth";

export async function bluetoothPrinterAdapter(commands: string[]) {
  return sendToBluetoothPrinter(commands);
}
