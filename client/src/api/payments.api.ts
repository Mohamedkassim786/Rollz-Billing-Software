import { apiClient } from "./client";

export interface PaymentTender {
  method: "CASH" | "UPI" | "CARD";
  amount: number; // in integer paise
  tenderedAmount?: number; // in integer paise
  externalReference?: string;
  notes?: string;
  confirmationType?: string;
}

export interface ProcessPaymentPayload {
  payments: PaymentTender[];
  idempotencyKey?: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  branchId: string;
  method: "CASH" | "UPI" | "CARD";
  amount: number;
  status: "CONFIRMED" | "FAILED" | "PENDING";
  externalReference?: string | null;
  confirmationType: string;
  tenderedAmount?: number | null;
  changeDue?: number | null;
  confirmedBy?: {
    id: string;
    displayName: string;
    username: string;
  };
  confirmedAt?: string;
  notes?: string | null;
  createdAt: string;
}

export interface PrintJobRecord {
  id: string;
  orderId: string;
  invoiceId?: string | null;
  branchId: string;
  destination: "CUSTOMER_RECEIPT" | "KITCHEN";
  status: "PENDING" | "PRINTING" | "PRINTED" | "FAILED";
  attemptCount: number;
  payloadSnapshot?: any;
  lastError?: string | null;
  isReprint: boolean;
  reprintReason?: string | null;
  printedAt?: string | null;
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  orderId: string;
  branchId: string;
  cashierId: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  status: string;
  snapshot: any;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNumber: string;
    orderType: "TAKEAWAY" | "DINE_IN";
    tableNumber?: string | null;
    customerName?: string | null;
    notes?: string | null;
  };
  cashier?: {
    id: string;
    displayName: string;
    username: string;
  };
  printJobs?: PrintJobRecord[];
}

export interface PaymentResultResponse {
  success: boolean;
  message: string;
  order: any;
  invoice: InvoiceRecord;
  payments: PaymentRecord[];
  printJobs: PrintJobRecord[];
  customer?: any;
  whatsapp?: {
    attempted: boolean;
    success: boolean;
    message: string;
    directUrl?: string;
  };
  isDuplicate?: boolean;
}

export const paymentsApi = {
  processPayment: async (
    orderId: string,
    payload: ProcessPaymentPayload
  ): Promise<PaymentResultResponse> => {
    const { data } = await apiClient.post<PaymentResultResponse>(
      `/orders/${orderId}/payments`,
      payload
    );
    return data;
  },

  getOrderPayments: async (orderId: string): Promise<PaymentRecord[]> => {
    const { data } = await apiClient.get<{ payments: PaymentRecord[] }>(
      `/orders/${orderId}/payments`
    );
    return data.payments;
  },

  getInvoices: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    invoices: InvoiceRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> => {
    const { data } = await apiClient.get("/invoices", { params });
    return data;
  },

  getInvoiceById: async (id: string): Promise<InvoiceRecord> => {
    const { data } = await apiClient.get<{ invoice: InvoiceRecord }>(
      `/invoices/${id}`
    );
    return data.invoice;
  },

  getInvoiceReceipt: async (id: string): Promise<{ rawText: string; metadata?: any }> => {
    const { data } = await apiClient.get<{ receipt: { rawText: string; metadata?: any } }>(
      `/invoices/${id}/receipt`
    );
    return data.receipt;
  },

  reprintInvoice: async (
    id: string,
    params: {
      destination?: "CUSTOMER_RECEIPT" | "KITCHEN";
      reason?: string;
    }
  ): Promise<{ success: boolean; printJob: PrintJobRecord }> => {
    const { data } = await apiClient.post(`/invoices/${id}/reprint`, params);
    return data;
  },

  retryPrintJob: async (
    jobId: string
  ): Promise<{ success: boolean; printJob: PrintJobRecord }> => {
    const { data } = await apiClient.post(`/print-jobs/${jobId}/retry`);
    return data;
  },
};
