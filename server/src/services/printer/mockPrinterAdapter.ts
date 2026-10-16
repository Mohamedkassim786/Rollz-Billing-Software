import { IPrinterAdapter, PrintDestinationType, PrintResult } from "./printer.types";

export interface LoggedPrintJob {
  jobId: string;
  destination: PrintDestinationType;
  rawText: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class MockPrinterAdapter implements IPrinterAdapter {
  public name = "Mock Thermal Printer Adapter (Development)";
  private shouldFail = false;
  private failMessage = "Printer connection timeout / Out of paper (Simulated)";
  private printHistory: LoggedPrintJob[] = [];

  /**
   * Configure simulated failure mode for automated testing or diagnostics
   */
  public setSimulateFailure(fail: boolean, message?: string): void {
    this.shouldFail = fail;
    if (message) this.failMessage = message;
  }

  public getPrintHistory(): LoggedPrintJob[] {
    return [...this.printHistory];
  }

  public getLastPrintJob(destination?: PrintDestinationType): LoggedPrintJob | undefined {
    if (!destination) {
      return this.printHistory[this.printHistory.length - 1];
    }
    const filtered = this.printHistory.filter((job) => job.destination === destination);
    return filtered[filtered.length - 1];
  }

  public clearHistory(): void {
    this.printHistory = [];
  }

  public async print(
    jobId: string,
    destination: PrintDestinationType,
    rawText: string,
    metadata?: Record<string, any>
  ): Promise<PrintResult> {
    const now = new Date();

    if (this.shouldFail) {
      const failedRecord: LoggedPrintJob = {
        jobId,
        destination,
        rawText,
        metadata,
        timestamp: now,
        success: false,
        error: this.failMessage,
      };
      this.printHistory.push(failedRecord);

      return {
        success: false,
        error: this.failMessage,
      };
    }

    const successRecord: LoggedPrintJob = {
      jobId,
      destination,
      rawText,
      metadata,
      timestamp: now,
      success: true,
    };
    this.printHistory.push(successRecord);

    return {
      success: true,
      printedAt: now,
      bytesSent: Buffer.byteLength(rawText, "utf-8"),
    };
  }
}

// Export singleton instance for the app
export const mockPrinterAdapter = new MockPrinterAdapter();
