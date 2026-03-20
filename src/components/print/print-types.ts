export type PrintableOrderItem = {
  dishId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
};

export type PrintableOrder = {
  id: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  customerNotes?: string;
  items: PrintableOrderItem[];
  subtotal: number;
  total: number;
};

export function formatPrintCurrency(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}
