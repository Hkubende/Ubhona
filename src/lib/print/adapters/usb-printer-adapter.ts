import type { PrintOrder } from "../models";

export async function usbPrinterAdapter(_order: PrintOrder, _commands: string[]) {
  void _order;
  void _commands;
  throw new Error("USB thermal printing is not implemented yet. TODO: wire WebUSB transport.");
}
