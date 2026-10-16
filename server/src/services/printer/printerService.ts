import { prisma } from "../../config/prisma";
import { mockPrinterAdapter } from "./mockPrinterAdapter";
import { NetworkTcpPrinterAdapter } from "./networkTcpPrinterAdapter";
import { PrintDestinationType, PrintJobStatus, FormattedPrintPayload, IPrinterAdapter } from "./printer.types";
import { generateCustomerReceiptText } from "./receiptTemplate";
import { generateKitchenTicketText } from "./kitchenTemplate";

export class PrinterService {
  private defaultAdapter: IPrinterAdapter = mockPrinterAdapter;

  public setAdapter(adapter: IPrinterAdapter) {
    this.defaultAdapter = adapter;
  }

  public getAdapter(): IPrinterAdapter {
    return this.defaultAdapter;
  }

  /**
   * Dynamically resolve the configured adapter for a given destination and branch
   */
  public async resolveAdapterForJob(
    destination: PrintDestinationType,
    branchId: string,
    clientDb?: any
  ): Promise<IPrinterAdapter> {
    const db = clientDb || prisma;

    try {
      const branch = await db.branch.findUnique({
        where: { id: branchId },
        select: {
          customerPrinterType: true,
          customerPrinterAddress: true,
          customerPrinterEnabled: true,
          kitchenPrinterType: true,
          kitchenPrinterAddress: true,
          kitchenPrinterEnabled: true,
        },
      });

      if (!branch) return this.defaultAdapter;

      if (destination === "CUSTOMER_RECEIPT") {
        if (!branch.customerPrinterEnabled) {
          return {
            name: "Customer Printer (Disabled)",
            print: async () => ({ success: false, error: "Customer receipt printer is disabled in settings" }),
          };
        }

        if (branch.customerPrinterType === "NETWORK_TCP" && branch.customerPrinterAddress) {
          const [host, portStr] = branch.customerPrinterAddress.split(":");
          const port = portStr ? parseInt(portStr) : 9100;
          return new NetworkTcpPrinterAdapter({ host, port, openCashDrawerOnReceipt: true });
        }
      } else if (destination === "KITCHEN") {
        if (!branch.kitchenPrinterEnabled) {
          return {
            name: "Kitchen Printer (Disabled)",
            print: async () => ({ success: false, error: "Kitchen ticket printer is disabled in settings" }),
          };
        }

        if (branch.kitchenPrinterType === "NETWORK_TCP" && branch.kitchenPrinterAddress) {
          const [host, portStr] = branch.kitchenPrinterAddress.split(":");
          const port = portStr ? parseInt(portStr) : 9100;
          return new NetworkTcpPrinterAdapter({ host, port });
        }
      }
    } catch {
      // Fallback on error to default adapter
    }

    return this.defaultAdapter;
  }

  /**
   * Process a single queued print job by ID
   */
  public async processPrintJob(jobId: string, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;

    const job = await db.printJob.findUnique({
      where: { id: jobId },
      include: {
        order: true,
        invoice: true,
      },
    });

    if (!job) {
      throw new Error(`PrintJob with ID ${jobId} not found`);
    }

    // Mark as PRINTING & increment attempt count
    await db.printJob.update({
      where: { id: jobId },
      data: {
        status: "PRINTING",
        attemptCount: { increment: 1 },
      },
    });

    const payload = job.payloadSnapshot as unknown as FormattedPrintPayload;
    const rawText = payload?.rawText || "";

    const adapter = await this.resolveAdapterForJob(
      job.destination as PrintDestinationType,
      job.branchId,
      db
    );

    try {
      const result = await adapter.print(
        job.id,
        job.destination as PrintDestinationType,
        rawText,
        payload?.metadata
      );

      if (result.success) {
        return await db.printJob.update({
          where: { id: jobId },
          data: {
            status: "PRINTED",
            printedAt: result.printedAt || new Date(),
            lastError: null,
          },
        });
      } else {
        return await db.printJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            lastError: result.error || "Printing failed",
          },
        });
      }
    } catch (err: any) {
      return await db.printJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          lastError: err.message || "Unexpected printer error",
        },
      });
    }
  }

  /**
   * Retry an eligible failed print job
   */
  public async retryPrintJob(jobId: string, branchId: string, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;

    const job = await db.printJob.findFirst({
      where: { id: jobId, branchId },
    });

    if (!job) {
      throw new Error("Print job not found");
    }

    if (job.status !== "FAILED") {
      throw new Error(`Only failed print jobs can be retried. Current status: ${job.status}`);
    }

    return await this.processPrintJob(jobId, db);
  }

  /**
   * Create an explicitly labeled reprint job for a finalized invoice/order
   */
  public async createReprintJob(params: {
    invoiceId: string;
    branchId: string;
    destination: PrintDestinationType;
    reason: string;
    cashierName: string;
  }, clientDb?: any): Promise<any> {
    const db = clientDb || prisma;

    const invoice = await db.invoice.findFirst({
      where: { id: params.invoiceId, branchId: params.branchId },
      include: {
        order: {
          include: {
            items: true,
            payments: true,
          },
        },
        branch: true,
        cashier: true,
      },
    });

    if (!invoice) {
      throw new Error("Finalized invoice not found");
    }

    let payload: FormattedPrintPayload;

    if (params.destination === "CUSTOMER_RECEIPT") {
      const snapshot = invoice.snapshot as any;
      payload = generateCustomerReceiptText({
        restaurantName: "ROLLZ",
        branchName: invoice.branch.name,
        branchAddress: invoice.branch.address,
        branchPhone: invoice.branch.phone,
        gstin: invoice.branch.gstin,
        taxMode: invoice.branch.taxMode,
        invoiceNumber: invoice.invoiceNumber,
        orderNumber: invoice.order.orderNumber,
        orderType: invoice.order.orderType,
        tableNumber: invoice.order.tableNumber,
        cashierName: params.cashierName || invoice.cashier.displayName,
        createdAt: invoice.createdAt,
        items: snapshot.items || invoice.order.items,
        subtotal: invoice.subtotal,
        discountTotal: invoice.discountTotal,
        discountReason: invoice.order.discountReason,
        taxTotal: invoice.taxTotal,
        taxRate: invoice.order.taxRate,
        grandTotal: invoice.grandTotal,
        payments: snapshot.payments || invoice.order.payments,
        receiptHeader: invoice.branch.receiptHeader,
        receiptFooter: invoice.branch.receiptFooter,
        isReprint: true,
        reprintReason: params.reason,
      });
    } else {
      payload = generateKitchenTicketText({
        orderNumber: invoice.order.orderNumber,
        orderType: invoice.order.orderType,
        tableNumber: invoice.order.tableNumber,
        cashierName: params.cashierName || invoice.cashier.displayName,
        createdAt: invoice.createdAt,
        items: invoice.order.items,
        orderNotes: invoice.order.notes,
        isReprint: true,
        reprintReason: params.reason,
      });
    }

    const printJob = await db.printJob.create({
      data: {
        orderId: invoice.order.id,
        invoiceId: invoice.id,
        branchId: params.branchId,
        destination: params.destination,
        status: "PENDING",
        attemptCount: 0,
        isReprint: true,
        reprintReason: params.reason,
        payloadSnapshot: payload as any,
      },
    });

    // Execute through adapter
    return await this.processPrintJob(printJob.id, db);
  }

  /**
   * Recover jobs left stuck in PRINTING status after an application crash or power loss
   */
  public async recoverStalePrintJobs(branchIdOrDb?: string | any, clientDb?: any): Promise<{
    recoveredCount: number;
    failedCount: number;
  }> {
    let branchId: string | undefined;
    let db = prisma;

    if (typeof branchIdOrDb === "string") {
      branchId = branchIdOrDb;
      db = clientDb || prisma;
    } else if (branchIdOrDb && typeof branchIdOrDb === "object") {
      db = branchIdOrDb;
      branchId = typeof clientDb === "string" ? clientDb : undefined;
    }

    const whereClause: any = { status: "PRINTING" };
    if (branchId) whereClause.branchId = branchId;

    const staleJobs = await db.printJob.findMany({
      where: whereClause,
    });

    let recoveredCount = 0;
    let failedCount = 0;

    for (const job of staleJobs) {
      if (job.attemptCount < 3) {
        await db.printJob.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            lastError: "Job interrupted by server restart; recovered for retry",
          },
        });
        recoveredCount++;
      } else {
        await db.printJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            lastError: "Print failed after reaching maximum crash attempts",
          },
        });
        failedCount++;
      }
    }

    return { recoveredCount, failedCount };
  }

  /**
   * Send a diagnostic test slip to the configured printer
   */
  public async testPrint(
    destination: PrintDestinationType,
    branchId: string,
    clientDb?: any
  ): Promise<{ success: boolean; message: string; destination: string; adapterName: string }> {
    const db = clientDb || prisma;

    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });

    const adapter = await this.resolveAdapterForJob(destination, branchId, db);
    const now = new Date();

    const testSlip = [
      "========================================",
      "         ROLLZ POS TEST PRINT           ",
      "========================================",
      `Branch:      ${branch?.name || "Main Branch"}`,
      `Destination: ${destination}`,
      `Adapter:     ${adapter.name}`,
      `Timestamp:   ${now.toLocaleString("en-IN")}`,
      "----------------------------------------",
      "STATUS: PRINTER IS WORKING PROPERLY",
      "Hardware check completed successfully.",
      "========================================",
      "\n\n\n",
    ].join("\n");

    const result = await adapter.print(`test-${Date.now()}`, destination, testSlip);

    return {
      success: result.success,
      message: result.success
        ? `Test ticket successfully dispatched via ${adapter.name}`
        : result.error || "Test print failed",
      destination,
      adapterName: adapter.name,
    };
  }
}

export const printerService = new PrinterService();
