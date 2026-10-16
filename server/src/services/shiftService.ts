import { prisma } from "../config/prisma";
import { ShiftStatus, CashMovementType } from "@prisma/client";

export interface StartShiftInput {
  branchId: string;
  cashierId: string;
  openingCash: number; // in integer paise
  idempotencyKey?: string;
}

export interface RecordCashMovementInput {
  branchId: string;
  shiftId: string;
  userId: string;
  type: CashMovementType;
  amount: number; // in integer paise (strictly > 0)
  reason: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface CloseShiftInput {
  branchId: string;
  shiftId: string;
  closingUserId: string;
  actualCash: number; // in integer paise
  closingNotes?: string;
  approvedByUserId?: string;
}

export interface ShiftFinancialSummary {
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

export class ShiftService {
  /**
   * Helper to generate unique human-readable shift sequence: SFT-YYYYMMDD-XXXX
   */
  private async generateShiftNumber(branchId: string, tx: any): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateKey = `${year}${month}${day}`;

    const startOfDay = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const count = await tx.cashierShift.count({
      where: {
        branchId,
        openedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return `SFT-${dateKey}-${String(count + 1).padStart(4, "0")}`;
  }

  /**
   * Start a new cashier shift.
   * Concurrency-safe: Rejects if the cashier already has an active OPEN shift in the branch.
   */
  public async startShift(input: StartShiftInput, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;
    const { branchId, cashierId, openingCash, idempotencyKey } = input;

    if (openingCash === undefined || openingCash === null || openingCash < 0) {
      throw new Error("Opening cash amount cannot be negative");
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await db.cashierShift.findUnique({
        where: { idempotencyKey },
        include: {
          cashier: { select: { id: true, displayName: true, username: true } },
        },
      });
      if (existing) {
        return {
          shift: existing,
          isDuplicate: true,
        };
      }
    }

    return await db.$transaction(async (tx: any) => {
      // Enforce at most one open shift per cashier in the branch
      const activeShift = await tx.cashierShift.findFirst({
        where: {
          branchId,
          cashierId,
          status: "OPEN",
        },
      });

      if (activeShift) {
        throw new Error(
          `Cashier already has an active open shift (${activeShift.shiftNumber}). Please close the current shift before starting a new one.`
        );
      }

      const shiftNumber = await this.generateShiftNumber(branchId, tx);

      const created = await tx.cashierShift.create({
        data: {
          branchId,
          shiftNumber,
          cashierId,
          openedAt: new Date(),
          openingCash: Math.round(openingCash),
          status: "OPEN",
          idempotencyKey: idempotencyKey || null,
        },
        include: {
          cashier: { select: { id: true, displayName: true, username: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      return {
        shift: created,
        isDuplicate: false,
      };
    });
  }

  /**
   * Retrieve active open shift for a cashier in a branch
   */
  public async getActiveShift(branchId: string, cashierId: string, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;

    const shift = await db.cashierShift.findFirst({
      where: {
        branchId,
        cashierId,
        status: "OPEN",
      },
      include: {
        cashier: { select: { id: true, displayName: true, username: true } },
        branch: { select: { id: true, name: true, code: true } },
        cashMovements: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, displayName: true } } },
        },
      },
    });

    if (!shift) {
      return null;
    }

    const financials = await this.calculateShiftFinancials(shift.id, branchId, db);

    return {
      shift,
      financials,
    };
  }

  /**
   * Authoritative Financial Calculation Engine for a shift.
   * Calculates cash sales, non-cash payments, cash additions/expenses,
   * and expected drawer balance from confirmed database records.
   */
  public async calculateShiftFinancials(
    shiftId: string,
    branchId: string,
    clientDb?: any
  ): Promise<ShiftFinancialSummary> {
    const db = clientDb || prisma;

    const shift = await db.cashierShift.findFirst({
      where: { id: shiftId, branchId },
    });

    if (!shift) {
      throw new Error("Shift not found in this branch");
    }

    // Query confirmed payments linked to this shift OR processed by this cashier during the shift window
    const payments = await db.payment.findMany({
      where: {
        branchId,
        status: "CONFIRMED",
        OR: [
          { shiftId: shift.id },
          {
            confirmedByUserId: shift.cashierId,
            confirmedAt: {
              gte: shift.openedAt,
              ...(shift.closedAt ? { lte: shift.closedAt } : {}),
            },
          },
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            subtotal: true,
            discountTotal: true,
            taxTotal: true,
            grandTotal: true,
            status: true,
          },
        },
      },
    });

    // Deduplicate payments by ID in case an order matched both OR conditions
    const paymentMap = new Map<string, any>();
    for (const p of payments) {
      // Must belong to a CONFIRMED order
      if (p.order && p.order.status === "CONFIRMED") {
        paymentMap.set(p.id, p);
      }
    }
    const uniquePayments = Array.from(paymentMap.values());

    // Separate payment methods
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;

    const orderPaymentsCount = new Map<string, number>();
    const uniqueOrders = new Map<string, any>();

    for (const p of uniquePayments) {
      if (p.method === "CASH") {
        cashSales += p.amount;
      } else if (p.method === "UPI") {
        upiSales += p.amount;
      } else if (p.method === "CARD") {
        cardSales += p.amount;
      }

      if (p.order) {
        uniqueOrders.set(p.order.id, p.order);
        orderPaymentsCount.set(p.order.id, (orderPaymentsCount.get(p.order.id) || 0) + 1);
      }
    }

    // Detect split payments (orders with > 1 payment record)
    let splitPaymentOrderCount = 0;
    for (const count of orderPaymentsCount.values()) {
      if (count > 1) {
        splitPaymentOrderCount++;
      }
    }

    // Query Cash Movements for this shift
    const cashMovements = await db.cashMovement.findMany({
      where: { shiftId: shift.id },
    });

    let cashInTotal = 0;
    let cashOutTotal = 0;

    for (const m of cashMovements) {
      if (m.type === "CASH_IN") {
        cashInTotal += m.amount;
      } else if (m.type === "CASH_OUT") {
        cashOutTotal += m.amount;
      }
    }

    const cashRefundsTotal = 0; // Structured for future cash refund support

    // Core Invariant: Expected Drawer Cash
    const expectedDrawerCash =
      shift.openingCash + cashSales + cashInTotal - cashOutTotal - cashRefundsTotal;

    // Order Totals
    let grossSales = 0;
    let discountsTotal = 0;
    let taxesTotal = 0;
    let netSales = 0;

    for (const ord of uniqueOrders.values()) {
      grossSales += ord.subtotal;
      discountsTotal += ord.discountTotal;
      taxesTotal += ord.taxTotal;
      netSales += ord.grandTotal;
    }

    const totalSales = cashSales + upiSales + cardSales;

    return {
      openingCash: shift.openingCash,
      cashSales,
      upiSales,
      cardSales,
      totalSales,
      splitPaymentOrderCount,
      cashInTotal,
      cashOutTotal,
      cashRefundsTotal,
      expectedDrawerCash,
      actualCash: shift.actualCash,
      cashDifference: shift.cashDifference,
      finalizedOrdersCount: uniqueOrders.size,
      grossSales,
      discountsTotal,
      taxesTotal,
      netSales,
    };
  }

  /**
   * Record controlled CASH IN or CASH OUT movements for an open shift
   */
  public async recordCashMovement(input: RecordCashMovementInput, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;
    const { branchId, shiftId, userId, type, amount, reason, notes, idempotencyKey } = input;

    if (!amount || amount <= 0) {
      throw new Error("Cash movement amount must be a positive integer in paise");
    }

    if (!reason || !reason.trim()) {
      throw new Error("Cash movement reason is mandatory");
    }

    if (!["CASH_IN", "CASH_OUT"].includes(type)) {
      throw new Error(`Invalid cash movement type: ${type}`);
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await db.cashMovement.findUnique({
        where: { idempotencyKey },
        include: { user: { select: { id: true, displayName: true } } },
      });
      if (existing) {
        return {
          movement: existing,
          isDuplicate: true,
        };
      }
    }

    const shift = await db.cashierShift.findFirst({
      where: { id: shiftId, branchId },
    });

    if (!shift) {
      throw new Error("Shift not found in this branch");
    }

    if (shift.status !== "OPEN") {
      throw new Error("Cannot record cash movements for a closed shift");
    }

    return await db.$transaction(async (tx: any) => {
      const movement = await tx.cashMovement.create({
        data: {
          branchId,
          shiftId: shift.id,
          type,
          amount: Math.round(amount),
          reason: reason.trim(),
          notes: notes?.trim() || null,
          userId,
          idempotencyKey: idempotencyKey || null,
        },
        include: {
          user: { select: { id: true, displayName: true, username: true } },
        },
      });

      const financials = await this.calculateShiftFinancials(shift.id, branchId, tx);

      return {
        movement,
        expectedDrawerCash: financials.expectedDrawerCash,
        isDuplicate: false,
      };
    });
  }

  /**
   * Close a cashier shift with physical cash count reconciliation and immutable summary snapshot
   */
  public async closeShift(input: CloseShiftInput, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;
    const { branchId, shiftId, closingUserId, actualCash, closingNotes, approvedByUserId } = input;

    if (actualCash === undefined || actualCash === null || actualCash < 0) {
      throw new Error("Actual counted cash cannot be negative");
    }

    const shift = await db.cashierShift.findFirst({
      where: { id: shiftId, branchId },
      include: {
        cashier: true,
        branch: true,
      },
    });

    if (!shift) {
      throw new Error("Shift not found in this branch");
    }

    if (shift.status === "CLOSED") {
      throw new Error("This shift is already closed and finalized");
    }

    return await db.$transaction(async (tx: any) => {
      const closedAt = new Date();
      const financials = await this.calculateShiftFinancials(shift.id, branchId, tx);

      const expectedCash = financials.expectedDrawerCash;
      const cashDifference = Math.round(actualCash) - expectedCash;

      // Discrepancy threshold: ₹500 (50,000 paise)
      const DISCREPANCY_THRESHOLD_PAISE = 50000;
      const hasSignificantDiscrepancy = Math.abs(cashDifference) > DISCREPANCY_THRESHOLD_PAISE;

      // Construct frozen immutable snapshot for historical audit
      const summarySnapshot = {
        shiftNumber: shift.shiftNumber,
        branchName: shift.branch.name,
        branchCode: shift.branch.code,
        cashierName: shift.cashier.displayName,
        cashierUsername: shift.cashier.username,
        openedAt: shift.openedAt,
        closedAt,
        durationMinutes: Math.round((closedAt.getTime() - shift.openedAt.getTime()) / 60000),
        openingCash: shift.openingCash,
        cashSales: financials.cashSales,
        upiSales: financials.upiSales,
        cardSales: financials.cardSales,
        totalSales: financials.totalSales,
        cashInTotal: financials.cashInTotal,
        cashOutTotal: financials.cashOutTotal,
        cashRefundsTotal: financials.cashRefundsTotal,
        expectedDrawerCash: expectedCash,
        actualCountedCash: Math.round(actualCash),
        cashDifference,
        discrepancyType:
          cashDifference > 0 ? "SURPLUS" : cashDifference < 0 ? "SHORTAGE" : "EXACT",
        hasSignificantDiscrepancy,
        finalizedOrdersCount: financials.finalizedOrdersCount,
        grossSales: financials.grossSales,
        discountsTotal: financials.discountsTotal,
        taxesTotal: financials.taxesTotal,
        netSales: financials.netSales,
        splitPaymentOrderCount: financials.splitPaymentOrderCount,
        closingNotes: closingNotes?.trim() || null,
        closedByUserId: closingUserId,
        approvedByUserId: approvedByUserId || null,
      };

      const updatedShift = await tx.cashierShift.update({
        where: { id: shift.id },
        data: {
          status: "CLOSED",
          closedAt,
          expectedCash,
          actualCash: Math.round(actualCash),
          cashDifference,
          closingNotes: closingNotes?.trim() || null,
          closedByUserId: closingUserId,
          approvedByUserId: approvedByUserId || null,
          summarySnapshot: summarySnapshot as any,
        },
        include: {
          cashier: { select: { id: true, displayName: true, username: true } },
          closedByUser: { select: { id: true, displayName: true, username: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      return {
        shift: updatedShift,
        financials: {
          ...financials,
          actualCash: Math.round(actualCash),
          cashDifference,
        },
        summarySnapshot,
      };
    });
  }

  /**
   * List shift history with pagination and status/date filters
   */
  public async getShifts(
    branchId: string,
    query: {
      cashierId?: string;
      status?: ShiftStatus;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {},
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = { branchId };

    if (query.cashierId) {
      where.cashierId = query.cashierId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.openedAt = {};
      if (query.startDate) where.openedAt.gte = new Date(query.startDate);
      if (query.endDate) where.openedAt.lte = new Date(query.endDate);
    }

    const [total, shifts] = await Promise.all([
      db.cashierShift.count({ where }),
      db.cashierShift.findMany({
        where,
        orderBy: { openedAt: "desc" },
        skip,
        take: limit,
        include: {
          cashier: { select: { id: true, displayName: true, username: true } },
          closedByUser: { select: { id: true, displayName: true } },
          _count: { select: { payments: true, cashMovements: true } },
        },
      }),
    ]);

    return {
      shifts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single shift details with complete financial reconciliation
   */
  public async getShiftById(shiftId: string, branchId: string, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;

    const shift = await db.cashierShift.findFirst({
      where: { id: shiftId, branchId },
      include: {
        cashier: { select: { id: true, displayName: true, username: true } },
        closedByUser: { select: { id: true, displayName: true } },
        branch: { select: { id: true, name: true, code: true, address: true, phone: true } },
        cashMovements: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, displayName: true } } },
        },
      },
    });

    if (!shift) {
      throw new Error("Shift not found in this branch");
    }

    const financials = await this.calculateShiftFinancials(shift.id, branchId, db);

    return {
      shift,
      financials,
    };
  }

  /**
   * Daily Sales & Financial Summary across the restaurant branch
   */
  public async getDailySalesSummary(
    branchId: string,
    targetDateStr?: string,
    clientDb?: any
  ): Promise<any> {
    const db = clientDb || prisma;

    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();

    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

    // 1. Invoices finalized on target date
    const invoices = await db.invoice.findMany({
      where: {
        branchId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    let grossSales = 0;
    let discountsTotal = 0;
    let taxesTotal = 0;
    let netSales = 0;

    for (const inv of invoices) {
      grossSales += inv.subtotal;
      discountsTotal += inv.discountTotal;
      taxesTotal += inv.taxTotal;
      netSales += inv.grandTotal;
    }

    // 2. Confirmed Payments recorded on target date
    const payments = await db.payment.findMany({
      where: {
        branchId,
        status: "CONFIRMED",
        confirmedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    let cashPayments = 0;
    let upiPayments = 0;
    let cardPayments = 0;

    for (const p of payments) {
      if (p.method === "CASH") cashPayments += p.amount;
      else if (p.method === "UPI") upiPayments += p.amount;
      else if (p.method === "CARD") cardPayments += p.amount;
    }

    // 3. Cash movements on target date
    const cashMovements = await db.cashMovement.findMany({
      where: {
        branchId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    let cashInTotal = 0;
    let cashOutTotal = 0;

    for (const m of cashMovements) {
      if (m.type === "CASH_IN") cashInTotal += m.amount;
      else if (m.type === "CASH_OUT") cashOutTotal += m.amount;
    }

    // 4. Shifts count for the day
    const [openedShiftsCount, closedShiftsCount] = await Promise.all([
      db.cashierShift.count({
        where: {
          branchId,
          openedAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      db.cashierShift.count({
        where: {
          branchId,
          status: "CLOSED",
          closedAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

    return {
      date: startOfDay.toISOString().split("T")[0],
      finalizedOrdersCount: invoices.length,
      grossSales,
      discountsTotal,
      taxesTotal,
      netSales,
      paymentBreakdown: {
        cash: cashPayments,
        upi: upiPayments,
        card: cardPayments,
        total: cashPayments + upiPayments + cardPayments,
      },
      cashExpensesTotal: cashOutTotal,
      cashAdditionsTotal: cashInTotal,
      shiftsOpenedCount: openedShiftsCount,
      shiftsClosedCount: closedShiftsCount,
    };
  }
}

export const shiftService = new ShiftService();
