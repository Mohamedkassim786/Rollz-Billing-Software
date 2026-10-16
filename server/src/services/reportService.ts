import { prisma } from "../config/prisma";
import { DateRangeResult, formatISTDate } from "../utils/reportDateUtils";

export interface DashboardSummaryResponse {
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
    date: string; // YYYY-MM-DD in IST
    ordersCount: number;
    grossSales: number;
    netSales: number;
  }>;
}

export class ReportService {
  /**
   * Main Analytics Dashboard Summary
   */
  public async getDashboardSummary(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<DashboardSummaryResponse> {
    const db = clientDb || prisma;

    // 1. Fetch all finalized invoices in the date range for the branch
    const invoices = await db.invoice.findMany({
      where: {
        branchId,
        status: "FINALIZED",
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        order: {
          select: {
            id: true,
            orderType: true,
            payments: {
              where: { status: "CONFIRMED" },
              select: { method: true, amount: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Overview counters
    let grossSales = 0;
    let discountsTotal = 0;
    let taxesTotal = 0;
    let netSales = 0;
    const ordersCount = invoices.length;

    // Order type breakdown
    const orderTypes = {
      takeaway: { count: 0, sales: 0, aov: 0 },
      dineIn: { count: 0, sales: 0, aov: 0 },
    };

    // Sales trend grouped by IST day
    const trendMap = new Map<string, { date: string; ordersCount: number; grossSales: number; netSales: number }>();

    // Payment method breakdown
    let cashCollections = 0;
    let upiCollections = 0;
    let cardCollections = 0;
    let splitOrderCount = 0;

    for (const inv of invoices) {
      grossSales += inv.subtotal;
      discountsTotal += inv.discountTotal;
      taxesTotal += inv.taxTotal;
      netSales += inv.grandTotal;

      // Group by IST Date for Trend
      const istDateKey = formatISTDate(inv.createdAt);
      const existingTrend = trendMap.get(istDateKey) || {
        date: istDateKey,
        ordersCount: 0,
        grossSales: 0,
        netSales: 0,
      };
      existingTrend.ordersCount += 1;
      existingTrend.grossSales += inv.subtotal;
      existingTrend.netSales += inv.grandTotal;
      trendMap.set(istDateKey, existingTrend);

      // Order Type
      const orderType = inv.order?.orderType;
      if (orderType === "DINE_IN") {
        orderTypes.dineIn.count += 1;
        orderTypes.dineIn.sales += inv.grandTotal;
      } else {
        // Default to TAKEAWAY
        orderTypes.takeaway.count += 1;
        orderTypes.takeaway.sales += inv.grandTotal;
      }

      // Payments associated with this finalized order
      const payments = inv.order?.payments || [];
      if (payments.length > 1) {
        splitOrderCount += 1;
      }
      for (const p of payments) {
        if (p.method === "CASH") cashCollections += p.amount;
        else if (p.method === "UPI") upiCollections += p.amount;
        else if (p.method === "CARD") cardCollections += p.amount;
      }
    }

    // Compute AOV
    const averageOrderValue = ordersCount > 0 ? Math.round(netSales / ordersCount) : 0;
    if (orderTypes.takeaway.count > 0) {
      orderTypes.takeaway.aov = Math.round(orderTypes.takeaway.sales / orderTypes.takeaway.count);
    }
    if (orderTypes.dineIn.count > 0) {
      orderTypes.dineIn.aov = Math.round(orderTypes.dineIn.sales / orderTypes.dineIn.count);
    }

    // Convert trendMap to array sorted by date
    const salesTrend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
        preset: range.preset,
      },
      overview: {
        finalizedOrdersCount: ordersCount,
        grossSales,
        discountsTotal,
        taxesTotal,
        netSales,
        averageOrderValue,
      },
      paymentsBreakdown: {
        cash: cashCollections,
        upi: upiCollections,
        card: cardCollections,
        total: cashCollections + upiCollections + cardCollections,
        splitOrderCount,
      },
      orderTypes,
      salesTrend,
    };
  }

  /**
   * Detailed Sales Report (Periodic Breakdown & Invoices)
   */
  public async getDetailedSalesReport(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const invoices = await db.invoice.findMany({
      where: {
        branchId,
        status: "FINALIZED",
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        cashier: { select: { id: true, displayName: true, username: true } },
        order: { select: { orderNumber: true, orderType: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Grouping by Date
    const dailyMap = new Map<string, {
      date: string;
      orderCount: number;
      grossSales: number;
      discounts: number;
      taxes: number;
      netSales: number;
    }>();

    for (const inv of invoices) {
      const dateKey = formatISTDate(inv.createdAt);
      const row = dailyMap.get(dateKey) || {
        date: dateKey,
        orderCount: 0,
        grossSales: 0,
        discounts: 0,
        taxes: 0,
        netSales: 0,
      };

      row.orderCount += 1;
      row.grossSales += inv.subtotal;
      row.discounts += inv.discountTotal;
      row.taxes += inv.taxTotal;
      row.netSales += inv.grandTotal;
      dailyMap.set(dateKey, row);
    }

    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
        preset: range.preset,
      },
      totalInvoicesCount: invoices.length,
      dailyBreakdown,
      invoices: invoices.slice(0, 100), // First 100 recent invoices
    };
  }

  /**
   * Top-Selling Menu Items
   */
  public async getTopSellingItems(
    branchId: string,
    range: DateRangeResult,
    sortBy: "quantity" | "value" = "value",
    limit = 20,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    // Fetch order items of finalized invoices in this branch & range
    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          branchId,
          status: "CONFIRMED",
          invoice: {
            status: "FINALIZED",
            createdAt: { gte: range.startDate, lte: range.endDate },
          },
        },
      },
      select: {
        menuItemId: true,
        itemNameSnapshot: true,
        quantity: true,
        lineSubtotal: true,
        discountAmount: true,
        lineTotal: true,
      },
    });

    const itemMap = new Map<string, {
      name: string;
      quantitySold: number;
      grossSales: number;
      discountsAllocated: number;
      netSales: number;
    }>();

    let grandTotalItemSales = 0;

    for (const item of orderItems) {
      const key = item.itemNameSnapshot || "Unknown Item";
      const existing = itemMap.get(key) || {
        name: key,
        quantitySold: 0,
        grossSales: 0,
        discountsAllocated: 0,
        netSales: 0,
      };

      existing.quantitySold += item.quantity;
      existing.grossSales += item.lineSubtotal;
      existing.discountsAllocated += item.discountAmount;
      existing.netSales += item.lineTotal;
      grandTotalItemSales += item.lineTotal;

      itemMap.set(key, existing);
    }

    const items = Array.from(itemMap.values()).map((it) => ({
      ...it,
      percentageOfSales: grandTotalItemSales > 0 ? Number(((it.netSales / grandTotalItemSales) * 100).toFixed(2)) : 0,
    }));

    // Sort
    if (sortBy === "quantity") {
      items.sort((a, b) => b.quantitySold - a.quantitySold);
    } else {
      items.sort((a, b) => b.netSales - a.netSales);
    }

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      totalItemsSold: items.reduce((acc, i) => acc + i.quantitySold, 0),
      grandTotalSales: grandTotalItemSales,
      items: items.slice(0, limit),
    };
  }

  /**
   * Category Sales Performance
   */
  public async getCategoryPerformance(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          branchId,
          status: "CONFIRMED",
          invoice: {
            status: "FINALIZED",
            createdAt: { gte: range.startDate, lte: range.endDate },
          },
        },
      },
      include: {
        menuItem: {
          select: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const catMap = new Map<string, {
      categoryName: string;
      quantitySold: number;
      salesValue: number;
    }>();

    let totalCategorySales = 0;

    for (const item of orderItems) {
      const catName = item.menuItem?.category?.name || "Uncategorized";
      const existing = catMap.get(catName) || {
        categoryName: catName,
        quantitySold: 0,
        salesValue: 0,
      };

      existing.quantitySold += item.quantity;
      existing.salesValue += item.lineTotal;
      totalCategorySales += item.lineTotal;
      catMap.set(catName, existing);
    }

    const categories = Array.from(catMap.values())
      .map((c) => ({
        ...c,
        percentageOfSales:
          totalCategorySales > 0 ? Number(((c.salesValue / totalCategorySales) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.salesValue - a.salesValue);

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      totalCategorySales,
      categories,
    };
  }

  /**
   * Payment Methods & Split Payments Report
   */
  public async getPaymentMethodReport(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const payments = await db.payment.findMany({
      where: {
        branchId,
        status: "CONFIRMED",
        confirmedAt: { gte: range.startDate, lte: range.endDate },
        order: {
          status: "CONFIRMED",
          invoice: { status: "FINALIZED" },
        },
      },
      select: {
        id: true,
        orderId: true,
        method: true,
        amount: true,
      },
    });

    // Grouping by payment method
    let cashTotal = 0;
    let cashCount = 0;
    let upiTotal = 0;
    let upiCount = 0;
    let cardTotal = 0;
    let cardCount = 0;

    // Track order payments to identify split tenders
    const orderPaymentMap = new Map<string, number>();

    for (const p of payments) {
      if (p.method === "CASH") {
        cashTotal += p.amount;
        cashCount += 1;
      } else if (p.method === "UPI") {
        upiTotal += p.amount;
        upiCount += 1;
      } else if (p.method === "CARD") {
        cardTotal += p.amount;
        cardCount += 1;
      }

      orderPaymentMap.set(p.orderId, (orderPaymentMap.get(p.orderId) || 0) + 1);
    }

    const totalCollected = cashTotal + upiTotal + cardTotal;
    const splitOrdersCount = Array.from(orderPaymentMap.values()).filter((c) => c > 1).length;

    const methods = [
      {
        method: "CASH",
        label: "Cash Tender",
        count: cashCount,
        amount: cashTotal,
        percentage: totalCollected > 0 ? Number(((cashTotal / totalCollected) * 100).toFixed(2)) : 0,
      },
      {
        method: "UPI",
        label: "UPI Direct QR / VPA",
        count: upiCount,
        amount: upiTotal,
        percentage: totalCollected > 0 ? Number(((upiTotal / totalCollected) * 100).toFixed(2)) : 0,
      },
      {
        method: "CARD",
        label: "Credit / Debit Card Terminal",
        count: cardCount,
        amount: cardTotal,
        percentage: totalCollected > 0 ? Number(((cardTotal / totalCollected) * 100).toFixed(2)) : 0,
      },
    ];

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      totalCollected,
      totalTransactions: payments.length,
      splitOrdersCount,
      methods,
    };
  }

  /**
   * Order Type Report (Takeaway vs Dine-In)
   */
  public async getOrderTypeReport(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const invoices = await db.invoice.findMany({
      where: {
        branchId,
        status: "FINALIZED",
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        order: { select: { orderType: true } },
      },
    });

    let takeawayCount = 0;
    let takeawaySales = 0;
    let dineInCount = 0;
    let dineInSales = 0;

    for (const inv of invoices) {
      if (inv.order?.orderType === "DINE_IN") {
        dineInCount += 1;
        dineInSales += inv.grandTotal;
      } else {
        takeawayCount += 1;
        takeawaySales += inv.grandTotal;
      }
    }

    const totalSales = takeawaySales + dineInSales;
    const totalOrders = invoices.length;

    const types = [
      {
        type: "TAKEAWAY",
        label: "Takeaway / Counter Pickup",
        count: takeawayCount,
        salesValue: takeawaySales,
        aov: takeawayCount > 0 ? Math.round(takeawaySales / takeawayCount) : 0,
        percentageOfSales: totalSales > 0 ? Number(((takeawaySales / totalSales) * 100).toFixed(2)) : 0,
      },
      {
        type: "DINE_IN",
        label: "Dine-In Restaurant Seating",
        count: dineInCount,
        salesValue: dineInSales,
        aov: dineInCount > 0 ? Math.round(dineInSales / dineInCount) : 0,
        percentageOfSales: totalSales > 0 ? Number(((dineInSales / totalSales) * 100).toFixed(2)) : 0,
      },
    ];

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      totalOrders,
      totalSales,
      types,
    };
  }

  /**
   * Discounts & Taxes Report
   */
  public async getDiscountsAndTaxesReport(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const invoices = await db.invoice.findMany({
      where: {
        branchId,
        status: "FINALIZED",
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      select: {
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        grandTotal: true,
      },
    });

    let grossSales = 0;
    let discountsTotal = 0;
    let discountedOrdersCount = 0;
    let taxesTotal = 0;
    let taxableSales = 0;

    for (const inv of invoices) {
      grossSales += inv.subtotal;
      taxesTotal += inv.taxTotal;

      if (inv.discountTotal > 0) {
        discountsTotal += inv.discountTotal;
        discountedOrdersCount += 1;
      }

      // Taxable sales = subtotal - discount
      taxableSales += Math.max(0, inv.subtotal - inv.discountTotal);
    }

    // 5% GST breakdown into 2.5% CGST and 2.5% SGST
    const cgstRecorded = Math.round(taxesTotal / 2);
    const sgstRecorded = taxesTotal - cgstRecorded;

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      summary: {
        grossSales,
        discountsTotal,
        discountedOrdersCount,
        averageDiscountPerDiscountedOrder:
          discountedOrdersCount > 0 ? Math.round(discountsTotal / discountedOrdersCount) : 0,
        taxableSales,
        totalTaxesRecorded: taxesTotal,
      },
      taxBreakdown: [
        {
          taxName: "Central GST (CGST)",
          ratePercentage: "2.5%",
          amount: cgstRecorded,
        },
        {
          taxName: "State GST (SGST)",
          ratePercentage: "2.5%",
          amount: sgstRecorded,
        },
      ],
    };
  }

  /**
   * Inventory & Wastage Report (Connecting with Phase 6)
   */
  public async getInventoryReport(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    // 1. Fetch stock movements in date range
    const movements = await db.stockMovement.findMany({
      where: {
        branchId,
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, costPerUnit: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let consumptionCount = 0;
    let intakeCount = 0;
    let wastageCount = 0;
    let adjustmentCount = 0;

    const ingredientUsageMap = new Map<string, {
      ingredientName: string;
      unit: string;
      consumedQty: number;
      wastedQty: number;
      intakeQty: number;
    }>();

    for (const m of movements) {
      const ingName = m.ingredient?.name || "Unknown Ingredient";
      const unit = m.ingredient?.unit || "unit";

      const usage = ingredientUsageMap.get(ingName) || {
        ingredientName: ingName,
        unit,
        consumedQty: 0,
        wastedQty: 0,
        intakeQty: 0,
      };

      if (m.type === "SALE_DEDUCTION") {
        consumptionCount += 1;
        usage.consumedQty += Math.abs(m.quantity);
      } else if (m.type === "STOCK_IN") {
        intakeCount += 1;
        usage.intakeQty += Math.abs(m.quantity);
      } else if (m.type === "WASTAGE") {
        wastageCount += 1;
        usage.wastedQty += Math.abs(m.quantity);
      } else {
        // STOCK_ADJUSTMENT or REVERSAL
        adjustmentCount += 1;
      }

      ingredientUsageMap.set(ingName, usage);
    }

    // 2. Fetch current low stock ingredients
    const lowStockIngredients = await db.ingredient.findMany({
      where: {
        branchId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        minThreshold: true,
        costPerUnit: true,
      },
    });

    const activeLowStock = lowStockIngredients.filter((ing: any) => ing.currentStock <= ing.minThreshold);

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      movementCounts: {
        saleDeductions: consumptionCount,
        stockIntakes: intakeCount,
        wastage: wastageCount,
        adjustments: adjustmentCount,
      },
      lowStockCount: activeLowStock.length,
      lowStockItems: activeLowStock,
      ingredientUsage: Array.from(ingredientUsageMap.values()).slice(0, 30),
    };
  }

  /**
   * Cash Management Report (Connecting with Phase 7)
   */
  public async getCashManagementReport(
    branchId: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const shifts = await db.cashierShift.findMany({
      where: {
        branchId,
        openedAt: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        cashier: { select: { displayName: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    const cashMovements = await db.cashMovement.findMany({
      where: {
        branchId,
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      select: {
        type: true,
        amount: true,
        reason: true,
      },
    });

    let totalCashIn = 0;
    let totalCashOut = 0;

    for (const m of cashMovements) {
      if (m.type === "CASH_IN") totalCashIn += m.amount;
      else if (m.type === "CASH_OUT") totalCashOut += m.amount;
    }

    let openedCount = 0;
    let closedCount = 0;
    let totalDifferences = 0;

    for (const s of shifts) {
      if (s.status === "OPEN") openedCount += 1;
      if (s.status === "CLOSED") {
        closedCount += 1;
        if (s.cashDifference !== null && s.cashDifference !== undefined) {
          totalDifferences += s.cashDifference;
        }
      }
    }

    return {
      dateRange: {
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      shiftSummary: {
        totalShifts: shifts.length,
        openedCount,
        closedCount,
        totalNetClosingDifference: totalDifferences,
      },
      movementsSummary: {
        totalCashAdded: totalCashIn,
        totalCashExpenses: totalCashOut,
        movementsCount: cashMovements.length,
      },
      shifts: shifts.slice(0, 50),
    };
  }

  /**
   * Export reports to CSV
   */
  public async exportReportCSV(
    branchId: string,
    reportType: string,
    range: DateRangeResult,
    clientDb?: any
  ): Promise<{ filename: string; csvContent: string }> {
    const safeType = reportType.toLowerCase();

    // Helper to escape CSV values
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const paiseToInr = (p: number): string => (p / 100).toFixed(2);

    switch (safeType) {
      case "sales": {
        const data = await this.getDetailedSalesReport(branchId, range, clientDb);
        const headers = ["Date", "Orders Count", "Gross Sales (INR)", "Discounts (INR)", "Taxes (INR)", "Net Sales (INR)"];
        const rows = data.dailyBreakdown.map((r: any) => [
          r.date,
          r.orderCount,
          paiseToInr(r.grossSales),
          paiseToInr(r.discounts),
          paiseToInr(r.taxes),
          paiseToInr(r.netSales),
        ]);

        const csv = [headers.join(","), ...rows.map((row: any[]) => row.map(escapeCsv).join(","))].join("\r\n");
        return {
          filename: `ROLLZ_Sales_Report_${range.startDateStr}_to_${range.endDateStr}.csv`,
          csvContent: csv,
        };
      }

      case "top-items": {
        const data = await this.getTopSellingItems(branchId, range, "value", 100, clientDb);
        const headers = ["Item Name", "Quantity Sold", "Gross Sales (INR)", "Discounts Allocated (INR)", "Net Sales (INR)", "Sales Share %"];
        const rows = data.items.map((it: any) => [
          it.name,
          it.quantitySold,
          paiseToInr(it.grossSales),
          paiseToInr(it.discountsAllocated),
          paiseToInr(it.netSales),
          `${it.percentageOfSales}%`,
        ]);

        const csv = [headers.join(","), ...rows.map((row: any[]) => row.map(escapeCsv).join(","))].join("\r\n");
        return {
          filename: `ROLLZ_Top_Items_${range.startDateStr}_to_${range.endDateStr}.csv`,
          csvContent: csv,
        };
      }

      case "categories": {
        const data = await this.getCategoryPerformance(branchId, range, clientDb);
        const headers = ["Category Name", "Quantity Sold", "Sales Value (INR)", "Sales Share %"];
        const rows = data.categories.map((c: any) => [
          c.categoryName,
          c.quantitySold,
          paiseToInr(c.salesValue),
          `${c.percentageOfSales}%`,
        ]);

        const csv = [headers.join(","), ...rows.map((row: any[]) => row.map(escapeCsv).join(","))].join("\r\n");
        return {
          filename: `ROLLZ_Category_Performance_${range.startDateStr}_to_${range.endDateStr}.csv`,
          csvContent: csv,
        };
      }

      case "payments": {
        const data = await this.getPaymentMethodReport(branchId, range, clientDb);
        const headers = ["Payment Method", "Transactions Count", "Amount Collected (INR)", "Share %"];
        const rows = data.methods.map((m: any) => [
          m.label,
          m.count,
          paiseToInr(m.amount),
          `${m.percentage}%`,
        ]);

        const csv = [headers.join(","), ...rows.map((row: any[]) => row.map(escapeCsv).join(","))].join("\r\n");
        return {
          filename: `ROLLZ_Payment_Breakdown_${range.startDateStr}_to_${range.endDateStr}.csv`,
          csvContent: csv,
        };
      }

      case "inventory": {
        const data = await this.getInventoryReport(branchId, range, clientDb);
        const headers = ["Ingredient", "Unit", "Total Consumed", "Total Wastage", "Total Intake"];
        const rows = data.ingredientUsage.map((u: any) => [
          u.ingredientName,
          u.unit,
          u.consumedQty,
          u.wastedQty,
          u.intakeQty,
        ]);

        const csv = [headers.join(","), ...rows.map((row: any[]) => row.map(escapeCsv).join(","))].join("\r\n");
        return {
          filename: `ROLLZ_Inventory_Movements_${range.startDateStr}_to_${range.endDateStr}.csv`,
          csvContent: csv,
        };
      }

      case "shifts": {
        const data = await this.getCashManagementReport(branchId, range, clientDb);
        const headers = ["Shift #", "Cashier", "Opened At", "Closed At", "Opening Float (INR)", "Expected (INR)", "Actual Count (INR)", "Difference (INR)", "Status"];
        const rows = data.shifts.map((s: any) => [
          s.shiftNumber,
          s.cashier?.displayName || "Cashier",
          s.openedAt ? new Date(s.openedAt).toISOString() : "",
          s.closedAt ? new Date(s.closedAt).toISOString() : "",
          paiseToInr(s.openingCash),
          s.expectedCash !== null ? paiseToInr(s.expectedCash) : "",
          s.actualCash !== null ? paiseToInr(s.actualCash) : "",
          s.cashDifference !== null ? paiseToInr(s.cashDifference) : "",
          s.status,
        ]);

        const csv = [headers.join(","), ...rows.map((row: any[]) => row.map(escapeCsv).join(","))].join("\r\n");
        return {
          filename: `ROLLZ_Cashier_Shifts_${range.startDateStr}_to_${range.endDateStr}.csv`,
          csvContent: csv,
        };
      }

      default:
        throw new Error(`Unsupported report export type: ${reportType}`);
    }
  }
}

export const reportService = new ReportService();
