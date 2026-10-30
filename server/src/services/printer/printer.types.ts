export type PrintDestinationType = "CUSTOMER_RECEIPT" | "KITCHEN";
export type PrintJobStatus = "PENDING" | "PRINTING" | "PRINTED" | "FAILED";
export type PrinterType = "MOCK" | "NETWORK_TCP" | "USB" | "BLUETOOTH";

export interface FormattedPrintPayload {
  destination: PrintDestinationType;
  invoiceNumber?: string;
  orderNumber: string;
  orderType: string;
  tableNumber?: string | null;
  timestamp: string;
  cashierName: string;
  isReprint?: boolean;
  reprintReason?: string | null;
  rawText: string;
  metadata?: Record<string, any>;
}

export interface PrintResult {
  success: boolean;
  error?: string;
  printedAt?: Date;
  bytesSent?: number;
}

export interface IPrinterAdapter {
  name: string;
  type?: PrinterType;
  print(
    jobId: string,
    destination: PrintDestinationType,
    rawText: string,
    metadata?: Record<string, any>
  ): Promise<PrintResult>;
}
