import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { IPrinterAdapter, PrintDestinationType, PrintResult, PrinterType } from "./printer.types";
import { getReceiptLogoBuffer } from "./logoHelper";

export interface UsbPrinterOptions {
  printerName?: string;
  openCashDrawerOnReceipt?: boolean;
  paperWidth?: number;
}

export function sanitizeThermalText(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/[•●]/g, "-")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...");
}

export class UsbPrinterAdapter implements IPrinterAdapter {
  public name: string;
  public type: PrinterType = "USB";
  private printerName: string;
  private openCashDrawer: boolean;
  private paperWidth: number;

  constructor(options: UsbPrinterOptions = {}) {
    this.printerName = (options.printerName || "").trim();
    this.openCashDrawer = options.openCashDrawerOnReceipt ?? true;
    this.paperWidth = options.paperWidth || 80;
    this.name = this.printerName
      ? `USB Thermal Printer (${this.printerName})`
      : "USB Thermal Printer (Default)";
  }

  public async print(
    jobId: string,
    destination: PrintDestinationType,
    rawText: string,
    metadata?: Record<string, any>
  ): Promise<PrintResult> {
    // 1. Prepare ESC/POS command sequences
    const cleanText = sanitizeThermalText(rawText);
    const initCommand = Buffer.from([0x1b, 0x40]);
    const logoBuffer =
      destination === "CUSTOMER_RECEIPT"
        ? getReceiptLogoBuffer(metadata?.logoPath)
        : Buffer.alloc(0);
    const textBuffer = Buffer.from(cleanText + "\n\n\n\n", "ascii");
    const cutCommand = Buffer.from([0x1d, 0x56, 0x00]);
    const drawerKick =
      this.openCashDrawer && destination === "CUSTOMER_RECEIPT"
        ? Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])
        : Buffer.alloc(0);

    const fullPayload = Buffer.concat([initCommand, logoBuffer, textBuffer, cutCommand, drawerKick]);

    // Windows Printing via Win32 RAW Spooler
    if (process.platform === "win32") {
      const tempFile = path.join(
        os.tmpdir(),
        `rollz-usb-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`
      );

      try {
        await fs.promises.writeFile(tempFile, fullPayload);
        const scriptName = "printRawWindows.ps1";
        const direct = path.resolve(__dirname, "scripts", scriptName);
        const scriptPath =
          fs.existsSync(direct)
            ? direct
            : fs.existsSync(path.resolve(__dirname, "../../../src/services/printer/scripts", scriptName))
            ? path.resolve(__dirname, "../../../src/services/printer/scripts", scriptName)
            : fs.existsSync(path.resolve(process.cwd(), "server/src/services/printer/scripts", scriptName))
            ? path.resolve(process.cwd(), "server/src/services/printer/scripts", scriptName)
            : fs.existsSync(path.resolve(process.cwd(), "src/services/printer/scripts", scriptName))
            ? path.resolve(process.cwd(), "src/services/printer/scripts", scriptName)
            : direct;

        return await new Promise<PrintResult>((resolve) => {
          execFile(
            "powershell",
            [
              "-NoProfile",
              "-NonInteractive",
              "-ExecutionPolicy",
              "Bypass",
              "-File",
              scriptPath,
              "-Target",
              this.printerName,
              "-FilePath",
              tempFile,
            ],
            { timeout: 10000 },
            async (error, stdout) => {
              // Always clean up temp file
              try {
                if (fs.existsSync(tempFile)) {
                  await fs.promises.unlink(tempFile);
                }
              } catch {
                // Ignore cleanup error
              }

              if (error) {
                resolve({
                  success: false,
                  error: `PowerShell print failed: ${error.message}`,
                });
                return;
              }

              try {
                const result = JSON.parse(stdout.trim());
                if (result.success) {
                  resolve({
                    success: true,
                    printedAt: new Date(),
                    bytesSent: result.bytesSent || fullPayload.length,
                  });
                } else {
                  resolve({
                    success: false,
                    error: result.error || "USB print failed",
                  });
                }
              } catch {
                resolve({
                  success: false,
                  error: stdout.trim() || "Unrecognized output from printer driver",
                });
              }
            }
          );
        });
      } catch (err: any) {
        try {
          if (fs.existsSync(tempFile)) await fs.promises.unlink(tempFile);
        } catch {
          // Ignore cleanup error
        }
        return {
          success: false,
          error: `Failed to prepare USB print file: ${err.message}`,
        };
      }
    }

    // Linux / macOS fallback
    if (this.printerName.startsWith("/dev/")) {
      try {
        await fs.promises.writeFile(this.printerName, fullPayload);
        return {
          success: true,
          printedAt: new Date(),
          bytesSent: fullPayload.length,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed writing to printer device ${this.printerName}: ${err.message}`,
        };
      }
    }

    // Unix CUPS raw spool fallback
    const tempFile = path.join(
      os.tmpdir(),
      `rollz-usb-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`
    );

    try {
      await fs.promises.writeFile(tempFile, fullPayload);
      return await new Promise<PrintResult>((resolve) => {
        execFile(
          "lp",
          ["-d", this.printerName || "default", "-o", "raw", tempFile],
          { timeout: 8000 },
          async (error) => {
            try {
              if (fs.existsSync(tempFile)) await fs.promises.unlink(tempFile);
            } catch {
              // Ignore cleanup error
            }
            if (error) {
              resolve({ success: false, error: `CUPS raw print failed: ${error.message}` });
            } else {
              resolve({ success: true, printedAt: new Date(), bytesSent: fullPayload.length });
            }
          }
        );
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
