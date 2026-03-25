import type { PrintOrder } from "../models";

export async function networkPrinterAdapter(_order: PrintOrder, _commands: string[]) {
  void _order;
  void _commands;
  throw new Error("Network thermal printing is not implemented yet. TODO: wire TCP/IP transport.");
}
