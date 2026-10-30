import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { IPrinterAdapter, PrintDestinationType, PrintResult, PrinterType } from "./printer.types";
import { sanitizeThermalText } from "./usbPrinterAdapter";
import { getReceiptLogoBuffer } from "./logoHelper";

export interface BluetoothPrinterOptions {
  address?: string;
  baudRate?: number;
  openCashDrawerOnReceipt?: boolean;
  paperWidth?: number;
}

export class BluetoothPrinterAdapter implements IPrinterAdapter {
  public name: string;
  public type: PrinterType = "BLUETOOTH";
  private address: string;
  private baudRate: number;
  private openCashDrawer: boolean;
  private paperWidth: number;

  constructor(options: BluetoothPrinterOptions = {}) {
    this.address = (options.address || "").trim();
    this.baudRate = options.baudRate || 9600;
    this.openCashDrawer = options.openCashDrawerOnReceipt ?? true;
    this.paperWidth = options.paperWidth || 80;
    this.name = this.address
      ? `Bluetooth Thermal Printer (${this.address})`
      : "Bluetooth Thermal Printer (Auto-detect)";
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

    // Windows Bluetooth / RFCOMM COM Port or Named Bluetooth Device
    if (process.platform === "win32") {
      const tempFile = path.join(
        os.tmpdir(),
        `rollz-bt-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`
      );

      try {
        await fs.promises.writeFile(tempFile, fullPayload);
        const scriptPath = path.resolve(__dirname, "scripts", "printRawWindows.ps1");

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
              this.address,
              "-FilePath",
              tempFile,
              "-BaudRate",
              String(this.baudRate),
            ],
            { timeout: 12000 },
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
                  error: `PowerShell Bluetooth print failed: ${error.message}`,
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
                    error: result.error || "Bluetooth print failed",
                  });
                }
              } catch {
                resolve({
                  success: false,
                  error: stdout.trim() || "Unrecognized output from Bluetooth adapter",
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
          error: `Failed to prepare Bluetooth print file: ${err.message}`,
        };
      }
    }

    // Linux / Android / macOS fallback
    if (this.address.startsWith("/dev/")) {
      try {
        await fs.promises.writeFile(this.address, fullPayload);
        return {
          success: true,
          printedAt: new Date(),
          bytesSent: fullPayload.length,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed writing to Bluetooth device ${this.address}: ${err.message}`,
        };
      }
    }

    return {
      success: false,
      error: `Unsupported Bluetooth configuration on this operating system for target: ${this.address}`,
    };
  }
}

