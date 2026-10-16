import { apiClient } from "./client";

export interface ReportDateParams {
  preset?: string;
  startDate?: string;
  endDate?: string;
}

export interface DashboardSummaryData {
  dateRange: {
    startDate: string;
    endDate: string;
    preset: string;
  };
  overview: {
    finalizedOrdersCount: number;
    grossSales: number;        // in paise
    discountsTotal: number;    // in paise
    taxesTotal: number;        // in paise
    netSales: number;          // in paise
    averageOrderValue: number; // in paise
  };
  paymentsBreakdown: {
    cash: number;
    upi: number;
    card: number;
    total: number;
    splitOrderCount: number;
  };
  orderTypes: {
    takeaway: { count: number; sales: number; aov: number };
    dineIn: { count: number; sales: number; aov: number };
  };
  salesTrend: Array<{
    date: string; // YYYY-MM-DD
    ordersCount: number;
    grossSales: number;
    netSales: number;
  }>;
}

export interface DetailedSalesReportData {
  dateRange: {
    startDate: string;
    endDate: string;
    preset: string;
  };
  totalInvoicesCount: number;
  dailyBreakdown: Array<{
    date: string;
    orderCount: number;
    grossSales: number;
    discounts: number;
    taxes: number;
    netSales: number;
  }>;
  invoices: any[];
}

export interface TopSellingItemsData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalItemsSold: number;
  grandTotalSales: number;
  items: Array<{
    name: string;
    quantitySold: number;
    grossSales: number;
    discountsAllocated: number;
    netSales: number;
    percentageOfSales: number;
  }>;
}

export interface CategoryPerformanceData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalCategorySales: number;
  categories: Array<{
    categoryName: string;
    quantitySold: number;
    salesValue: number;
    percentageOfSales: number;
  }>;
}

export interface PaymentMethodReportData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalCollected: number;
  totalTransactions: number;
  splitOrdersCount: number;
  methods: Array<{
    method: string;
    label: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
}

export interface DiscountsAndTaxesData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    grossSales: number;
    discountsTotal: number;
    discountedOrdersCount: number;
    averageDiscountPerDiscountedOrder: number;
    taxableSales: number;
    totalTaxesRecorded: number;
  };
  taxBreakdown: Array<{
    taxName: string;
    ratePercentage: string;
    amount: number;
  }>;
}

export interface InventoryReportData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  movementCounts: {
    orderConsumption: number;
    purchaseIntake: number;
    wastage: number;
    adjustments: number;
  };
  lowStockCount: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    minThreshold: number;
    costPerUnit: number;
  }>;
  ingredientUsage: Array<{
    ingredientName: string;
    unit: string;
    consumedQty: number;
    wastedQty: number;
    intakeQty: number;
  }>;
}

export interface CashReportData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  shiftSummary: {
    totalShifts: number;
    openedCount: number;
    closedCount: number;
    totalNetClosingDifference: number;
  };
  movementsSummary: {
    totalCashAdded: number;
    totalCashExpenses: number;
    movementsCount: number;
  };
  shifts: any[];
}

export const reportsApi = {
  getDashboardSummary: async (params?: ReportDateParams): Promise<DashboardSummaryData> => {
    const res = await apiClient.get("/reports/dashboard", { params });
    return res.data.data;
  },

  getDetailedSalesReport: async (params?: ReportDateParams): Promise<DetailedSalesReportData> => {
    const res = await apiClient.get("/reports/sales", { params });
    return res.data.data;
  },

  getTopSellingItems: async (
    params?: ReportDateParams & { sortBy?: "quantity" | "value"; limit?: number }
  ): Promise<TopSellingItemsData> => {
    const res = await apiClient.get("/reports/top-items", { params });
    return res.data.data;
  },

  getCategoryPerformance: async (params?: ReportDateParams): Promise<CategoryPerformanceData> => {
    const res = await apiClient.get("/reports/categories", { params });
    return res.data.data;
  },

  getPaymentMethodReport: async (params?: ReportDateParams): Promise<PaymentMethodReportData> => {
    const res = await apiClient.get("/reports/payments", { params });
    return res.data.data;
  },

  getDiscountsAndTaxesReport: async (params?: ReportDateParams): Promise<DiscountsAndTaxesData> => {
    const res = await apiClient.get("/reports/taxes", { params });
    return res.data.data;
  },

  getInventoryReport: async (params?: ReportDateParams): Promise<InventoryReportData> => {
    const res = await apiClient.get("/reports/inventory", { params });
    return res.data.data;
  },

  getCashReport: async (params?: ReportDateParams): Promise<CashReportData> => {
    const res = await apiClient.get("/reports/cash", { params });
    return res.data.data;
  },

  downloadCSV: async (reportType: string, params?: ReportDateParams) => {
    const res = await apiClient.get(`/reports/export/${reportType}`, {
      params,
      responseType: "blob",
    });

    // Extract filename from header or fallback
    const disposition = res.headers["content-disposition"];
    let filename = `ROLLZ_${reportType}_report.csv`;
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
