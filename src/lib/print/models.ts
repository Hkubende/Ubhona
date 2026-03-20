export type PrintMode = "manual" | "auto";
export type PrinterTransport = "browser" | "bluetooth" | "escpos-preview";
export type PaperWidth = "80mm" | "58mm";

export type PrintRestaurantInfo = {
  name: string;
  phone?: string;
  location?: string;
  footerText?: string;
};

export type PrintOrderItem = {
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
};

export type PrintPaymentInfo = {
  status: string;
  method: string;
  transactionId?: string;
  paidAmount?: number;
  changeAmount?: number;
};

export type PrintOrder = {
  id: string;
  restaurant: PrintRestaurantInfo;
  customerName?: string;
  customerPhone?: string;
  takenByWaiterName?: string;
  tableNumber?: string;
  createdAt: string;
  items: PrintOrderItem[];
  subtotal: number;
  total: number;
  notes?: string;
  payment?: PrintPaymentInfo;
};

export type FormattedPrintDocument = {
  title: string;
  lines: string[];
  paperWidth: PaperWidth;
};
