import { apiClient } from "./client";

export type ShiftStatus = "OPEN" | "CLOSED";
export type CashMovementType = "CASH_IN" | "CASH_OUT";

export interface CashMovement {
  id: string;
  shiftId: string;
  type: CashMovementType;
  amount: number; // in integer paise
  reason: string;
  notes?: string | null;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    username: string;
  };
}

export interface CashierShift {
  id: string;
  branchId: string;
  shiftNumber: string;
  cashierId: string;
  openedAt: string;
  openingCash: number; // in paise
  closedAt?: string | null;
  status: ShiftStatus;
  expectedCash?: number | null;
  actualCash?: number | null;
  cashDifference?: number | null;
  closingNotes?: string | null;
  closedByUserId?: string | null;
  approvedByUserId?: string | null;
  summarySnapshot?: any;
  createdAt: string;
  updatedAt: string;
  cashier: {
    id: string;
    displayName: string;
    username: string;
  };
  closedByUser?: {
    id: string;
    displayName: string;
    username: string;
  } | null;
  cashMovements?: CashMovement[];
  _count?: {
    payments: number;
    cashMovements: number;
  };
}

export interface ShiftFinancials {
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  totalSales: number;
  splitPaymentOrderCount: number;
  cashInTotal: number;
  cashOutTotal: number;
  cashRefundsTotal: number;
  expectedDrawerCash: number;
  actualCash?: number | null;
  cashDifference?: number | null;
  finalizedOrdersCount: number;
  grossSales: number;
  discountsTotal: number;
  taxesTotal: number;
  netSales: number;
}

export interface DailySalesSummary {
  date: string;
  finalizedOrdersCount: number;
  grossSales: number;
  discountsTotal: number;
  taxesTotal: number;
  netSales: number;
  paymentBreakdown: {
    cash: number;
    upi: number;
    card: number;
    total: number;
  };
  cashExpensesTotal: number;
  cashAdditionsTotal: number;
  shiftsOpenedCount: number;
  shiftsClosedCount: number;
}

export const shiftsApi = {
  startShift: async (openingCash: number): Promise<CashierShift> => {
    const res = await apiClient.post("/shifts/start", { openingCash });
    return res.data.data;
  },

  getActiveShift: async (): Promise<{ shift: CashierShift | null; financials?: ShiftFinancials } | null> => {
    const res = await apiClient.get("/shifts/active");
    return res.data.data;
  },

  recordCashMovement: async (data: {
    shiftId?: string;
    type: CashMovementType;
    amount: number; // in paise
    reason: string;
    notes?: string;
  }): Promise<{ movement: CashMovement; expectedDrawerCash: number }> => {
    const res = await apiClient.post("/shifts/active/cash-movement", data);
    return res.data.data;
  },

  getClosingPreview: async (shiftId: string): Promise<ShiftFinancials> => {
    const res = await apiClient.get(`/shifts/${shiftId}/closing-preview`);
    return res.data.data;
  },

  closeShift: async (
    shiftId: string,
    data: { actualCash: number; closingNotes?: string; approvedByUserId?: string }
  ): Promise<{ shift: CashierShift; financials: ShiftFinancials; summarySnapshot: any }> => {
    const res = await apiClient.post(`/shifts/${shiftId}/close`, data);
    return res.data.data;
  },

  getShiftById: async (shiftId: string): Promise<{ shift: CashierShift; financials: ShiftFinancials }> => {
    const res = await apiClient.get(`/shifts/${shiftId}`);
    return res.data.data;
  },

  getShiftReport: async (shiftId: string): Promise<{ reportText: string; data: { shift: CashierShift; financials: ShiftFinancials } }> => {
    const res = await apiClient.get(`/shifts/${shiftId}/report`);
    return res.data;
  },

  listShifts: async (params?: {
    cashierId?: string;
    status?: ShiftStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ shifts: CashierShift[]; pagination: any }> => {
    const res = await apiClient.get("/shifts", { params });
    return res.data.data;
  },

  getDailySummary: async (date?: string): Promise<DailySalesSummary> => {
    const res = await apiClient.get("/shifts/summary/daily", { params: { date } });
    return res.data.data;
  },
};
