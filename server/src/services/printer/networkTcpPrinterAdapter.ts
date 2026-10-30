import net from "net";
import { IPrinterAdapter, PrintDestinationType, PrintResult } from "./printer.types";
import { sanitizeThermalText } from "./usbPrinterAdapter";
import { getReceiptLogoBuffer } from "./logoHelper";

export interface NetworkPrinterOptions {
  host: string;
  port?: number;
  timeoutMs?: number;
  openCashDrawerOnReceipt?: boolean;
}

export class NetworkTcpPrinterAdapter implements IPrinterAdapter {
  public name: string;
  public type: "NETWORK_TCP" = "NETWORK_TCP";
  private host: string;
  private port: number;
  private timeoutMs: number;
  private openCashDrawer: boolean;

  constructor(options: NetworkPrinterOptions) {
    this.host = options.host;
    this.port = options.port || 9100;
    this.timeoutMs = options.timeoutMs || 4000; // 4 second timeout
    this.openCashDrawer = options.openCashDrawerOnReceipt ?? false;
    this.name = `Network ESC/POS Printer (${this.host}:${this.port})`;
  }

  /**
   * Test network connection to printer without cutting paper
   */
  public async testConnection(): Promise<{ connected: boolean; message: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeoutMs);

      socket.on("connect", () => {
        socket.destroy();
        resolve({
          connected: true,
          message: `Successfully connected to thermal printer at ${this.host}:${this.port}`,
        });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          connected: false,
          message: `Connection timed out after ${this.timeoutMs}ms trying to reach ${this.host}:${this.port}`,
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({
          connected: false,
          message: `Printer connection error: ${err.message}`,
        });
      });

      socket.connect(this.port, this.host);
    });
  }

  /**
   * Print raw text via raw TCP socket with ESC/POS commands
   */
  public async print(
    jobId: string,
    destination: PrintDestinationType,
    rawText: string,
    metadata?: Record<string, any>
  ): Promise<PrintResult> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeoutMs);

      // ESC/POS Command Sequences
      // 1. ESC @ : Initialize printer
      const initCommand = Buffer.from([0x1b, 0x40]);
      const logoBuffer =
        destination === "CUSTOMER_RECEIPT"
          ? getReceiptLogoBuffer(metadata?.logoPath)
          : Buffer.alloc(0);

      // 2. Text payload in clean ASCII
      const cleanText = sanitizeThermalText(rawText);
      const textBuffer = Buffer.from(cleanText + "\n\n\n", "ascii");

      // 3. GS V 0 : Full cut paper command
      const cutCommand = Buffer.from([0x1d, 0x56, 0x00]);

      // 4. Optional Cash Drawer Kick for Customer Receipts: ESC p 0 25 250
      const drawerKick =
        this.openCashDrawer && destination === "CUSTOMER_RECEIPT"
          ? Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])
          : Buffer.alloc(0);

      const fullPayload = Buffer.concat([initCommand, logoBuffer, textBuffer, cutCommand, drawerKick]);

      socket.on("connect", () => {
        socket.write(fullPayload, (err) => {
          if (err) {
            socket.destroy();
            resolve({
              success: false,
              error: `Write failed: ${err.message}`,
            });
            return;
          }

          socket.end(() => {
            resolve({
              success: true,
              printedAt: new Date(),
              bytesSent: fullPayload.length,
            });
          });
        });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          success: false,
          error: `Printer socket timed out connecting to ${this.host}:${this.port}`,
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({
          success: false,
          error: `Network printer connection error (${this.host}:${this.port}): ${err.message}`,
        });
      });

      socket.connect(this.port, this.host);
    });
  }
}
