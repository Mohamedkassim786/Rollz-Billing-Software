import { prisma } from "../config/prisma";
import { generateInvoiceNumber, buildInvoiceSnapshot } from "./invoiceService";
import { generateCustomerReceiptText } from "./printer/receiptTemplate";
import { generateKitchenTicketText } from "./printer/kitchenTemplate";
import { printerService } from "./printer/printerService";
import { inventoryService } from "./inventoryService";
import { customerService } from "./customerService";
import { whatsappService } from "./whatsappService";

export interface PaymentTenderInput {
  method: "CASH" | "UPI" | "CARD";
  amount: number; // in integer paise
  tenderedAmount?: number; // in integer paise (for cash)
  externalReference?: string;
  notes?: string;
  confirmationType?: string;
}

export interface ProcessOrderPaymentParams {
  orderId: string;
  branchId: string;
  cashierId: string;
  payments: PaymentTenderInput[];
  idempotencyKey?: string;
}

export class PaymentService {
  /**
   * Process payment, finalize order, generate unique invoice,
   * and create customer receipt & kitchen print jobs in a single atomic transaction.
   */
  public async processPaymentAndFinalize(params: ProcessOrderPaymentParams, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;

    const { orderId, branchId, cashierId, payments, idempotencyKey } = params;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingPayment = await db.payment.findFirst({
        where: {
          OR: [
            { idempotencyKey },
            { idempotencyKey: `${idempotencyKey}-0` },
          ],
        },
        include: {
          order: {
            include: {
              invoice: true,
              payments: true,
              printJobs: true,
            },
          },
        },
      });

      if (existingPayment) {
        return {
          order: existingPayment.order,
          invoice: existingPayment.order.invoice,
          payments: existingPayment.order.payments,
          printJobs: existingPayment.order.printJobs,
          isDuplicate: true,
        };
      }
    }

    // 2. Fetch and Validate Order
    const order = await db.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        items: true,
        branch: true,
        cashier: true,
      },
    });

    if (!order) {
      throw new Error("Order not found or branch mismatch");
    }

    if (order.status === "CONFIRMED") {
      const existingInvoice = await db.invoice.findUnique({
        where: { orderId: order.id },
      });
      if (existingInvoice) {
        const existingPayments = await db.payment.findMany({
          where: { orderId: order.id },
        });
        const existingPrintJobs = await db.printJob.findMany({
          where: { orderId: order.id },
        });
        return {
          order,
          invoice: existingInvoice,
          payments: existingPayments,
          printJobs: existingPrintJobs,
          isDuplicate: true,
        };
      }
      throw new Error("Order is already finalized and confirmed");
    }

    if (order.status === "CANCELLED") {
      throw new Error("Cannot pay for a cancelled order draft");
    }

    if (!order.items || order.items.length === 0) {
      throw new Error("Order has no items. Cannot finalize an empty cart");
    }

    // 3. Validate Payments
    if (!payments || payments.length === 0) {
      throw new Error("At least one payment tender is required");
    }

    let totalPaymentAmount = 0;
    for (const tender of payments) {
      if (!tender.amount || tender.amount <= 0) {
        throw new Error("Payment amount must be a positive integer in paise");
      }
      if (!["CASH", "UPI", "CARD"].includes(tender.method)) {
        throw new Error(`Unsupported payment method: ${tender.method}`);
      }
      if (tender.method === "CASH") {
        if (tender.tenderedAmount !== undefined && tender.tenderedAmount !== null) {
          if (tender.tenderedAmount < tender.amount) {
            throw new Error(
              `Tendered cash (₹${(tender.tenderedAmount / 100).toFixed(2)}) cannot be less than required cash payment (₹${(tender.amount / 100).toFixed(2)})`
            );
          }
        }
      }
      totalPaymentAmount += tender.amount;
    }

    // Exact payable match required for order finalization
    if (totalPaymentAmount < order.grandTotal) {
      throw new Error(
        `Insufficient payment: Provided ₹${(totalPaymentAmount / 100).toFixed(2)}, required ₹${(order.grandTotal / 100).toFixed(2)}`
      );
    }

    if (totalPaymentAmount > order.grandTotal) {
      throw new Error(
        `Overpayment rejected: Total tenders ₹${(totalPaymentAmount / 100).toFixed(2)} exceed payable amount ₹${(order.grandTotal / 100).toFixed(2)}`
      );
    }

    // 4. Fetch Cashier & Branch details
    const cashier = await db.user.findFirst({
      where: { id: cashierId, branchId },
    });
    if (!cashier) {
      throw new Error("Cashier user not found in this branch");
    }

    // 5. Execute Atomic Database Transaction
    const result = await db.$transaction(async (tx: any) => {
      // 5a. Look up active cashier shift if currently open
      const activeShift = await tx.cashierShift.findFirst({
        where: { cashierId, branchId, status: "OPEN" },
      });

      // Record Payment rows
      const createdPayments = [];
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        const tendered = p.tenderedAmount ?? (p.method === "CASH" ? p.amount : null);
        const changeDue = tendered !== null && tendered !== undefined ? tendered - p.amount : null;
        const key = idempotencyKey ? `${idempotencyKey}-${i}` : undefined;

        const paymentRecord = await tx.payment.create({
          data: {
            orderId: order.id,
            branchId,
            shiftId: activeShift ? activeShift.id : null,
            method: p.method,
            amount: p.amount,
            status: "CONFIRMED",
            externalReference: p.externalReference || null,
            confirmationType: p.confirmationType || "MANUAL_CASHIER",
            confirmedByUserId: cashierId,
            confirmedAt: new Date(),
            tenderedAmount: tendered,
            changeDue,
            idempotencyKey: key,
            notes: p.notes || null,
          },
        });
        createdPayments.push(paymentRecord);
      }

      // 5a-2. Upsert customer CRM record if customer phone is provided
      let customerRecord = null;
      if (order.customerPhone) {
        try {
          customerRecord = await customerService.upsertCustomer(
            {
              branchId,
              name: order.customerName || "Valued Customer",
              phone: order.customerPhone,
              orderSpendPaise: order.grandTotal,
            },
            tx
          );
        } catch (custErr) {
          console.warn("Failed to upsert customer CRM record during payment:", custErr);
        }
      }

      // 5b. Update Order status to finalized CONFIRMED and link customer
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CONFIRMED",
          customerId: customerRecord?.id || null,
        },
      });

      // 5c. Generate unique invoice number atomically
      const invoiceNumber = await generateInvoiceNumber(branchId, tx);

      // 5d. Create frozen snapshot
      const snapshot = buildInvoiceSnapshot({
        branch: order.branch,
        cashier,
        order: updatedOrder,
        items: order.items,
        payments: createdPayments,
      });

      // 5e. Create Invoice
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          branchId,
          cashierId,
          subtotal: order.subtotal,
          discountTotal: order.discountTotal,
          taxTotal: order.taxTotal,
          grandTotal: order.grandTotal,
          status: "FINALIZED",
          snapshot: snapshot as any,
        },
      });

      // 5e-2. CRITICAL INVARIANT: Automatic Stock Deduction for Finalized & Paid Order
      await inventoryService.deductStockForFinalizedOrder(
        order.id,
        branchId,
        createdInvoice.id,
        cashierId,
        tx
      );

      // 5f. Format & create Customer Receipt PrintJob
      const receiptPayload = generateCustomerReceiptText({
        restaurantName: "ROLLZ",
        branchName: order.branch.name,
        branchAddress: order.branch.address,
        branchPhone: order.branch.phone,
        gstin: order.branch.gstin,
        taxMode: order.branch.taxMode,
        invoiceNumber,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber: order.tableNumber,
        cashierName: cashier.displayName,
        createdAt: createdInvoice.createdAt,
        items: order.items,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        discountReason: order.discountReason,
        taxTotal: order.taxTotal,
        taxRate: order.taxRate,
        grandTotal: order.grandTotal,
        payments: createdPayments.map((p) => ({
          method: p.method as any,
          amount: p.amount,
          tenderedAmount: p.tenderedAmount,
          changeDue: p.changeDue,
          externalReference: p.externalReference,
        })),
        receiptHeader: order.branch.receiptHeader,
        receiptFooter: order.branch.receiptFooter,
        isReprint: false,
      });

      const customerPrintJob = await tx.printJob.create({
        data: {
          orderId: order.id,
          invoiceId: createdInvoice.id,
          branchId,
          destination: "CUSTOMER_RECEIPT",
          status: "PENDING",
          attemptCount: 0,
          payloadSnapshot: receiptPayload as any,
        },
      });

      // 5g. CRITICAL INVARIANT: Generate & create Kitchen Order Ticket ONLY because order is confirmed & paid
      const kitchenPayload = generateKitchenTicketText({
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber: order.tableNumber,
        cashierName: cashier.displayName,
        createdAt: createdInvoice.createdAt,
        items: order.items,
        orderNotes: order.notes,
        isReprint: false,
      });

      const kitchenPrintJob = await tx.printJob.create({
        data: {
          orderId: order.id,
          invoiceId: createdInvoice.id,
          branchId,
          destination: "KITCHEN",
          status: "PENDING",
          attemptCount: 0,
          payloadSnapshot: kitchenPayload as any,
        },
      });

      return {
        order: updatedOrder,
        invoice: createdInvoice,
        payments: createdPayments,
        customer: customerRecord,
        printJobs: [customerPrintJob, kitchenPrintJob],
      };
    });

    // 6. Post-transaction print dispatch (non-blocking, failures do not revert payment)
    for (const job of result.printJobs) {
      try {
        await printerService.processPrintJob(job.id, db);
      } catch (printErr) {
        console.error(`Printer dispatch failed for job ${job.id}:`, printErr);
      }
    }

    // Refresh print jobs to return current status
    const refreshedPrintJobs = await db.printJob.findMany({
      where: { orderId: order.id },
    });

    // 7. Post-transaction WhatsApp receipt dispatch (non-blocking)
    let whatsappStatus: { attempted: boolean; success: boolean; message: string; directUrl?: string } = {
      attempted: false,
      success: false,
      message: "",
    };

    if (order.customerPhone) {
      whatsappStatus.attempted = true;
      try {
        const waResult = await whatsappService.sendOrderReceiptMessage({
          order: {
            orderNumber: order.orderNumber,
            orderType: order.orderType,
            subtotal: order.subtotal,
            discountTotal: order.discountTotal,
            taxTotal: order.taxTotal,
            grandTotal: order.grandTotal,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            items: order.items.map((i: any) => ({
              itemNameSnapshot: i.itemNameSnapshot,
              quantity: i.quantity,
              lineTotal: i.lineTotal,
              kitchenNotes: i.kitchenNotes,
            })),
          },
          invoice: result.invoice,
          branch: order.branch,
          customer: result.customer,
          paymentMethod: result.payments.map((p: any) => p.method).join(", "),
        });

        whatsappStatus.success = waResult.success;
        whatsappStatus.message = waResult.success ? "Message delivered via WhatsApp" : (waResult.error || "Offline");
      } catch (waErr: any) {
        console.error("WhatsApp dispatch error:", waErr);
        whatsappStatus.message = waErr.message || "Failed to send message";
      }

      // Generate fallback direct link
      const fallbackText = `Hello! Here is your bill from ${order.branch.name || "Rollz"}: Invoice #${result.invoice.invoiceNumber}, Total: ₹${(order.grandTotal / 100).toFixed(2)}. Thank you for dining with us!`;
      whatsappStatus.directUrl = whatsappService.generateDirectWhatsAppLink(order.customerPhone, fallbackText);
    }

    return {
      ...result,
      printJobs: refreshedPrintJobs,
      whatsapp: whatsappStatus,
    };
  }
}

export const paymentService = new PaymentService();
