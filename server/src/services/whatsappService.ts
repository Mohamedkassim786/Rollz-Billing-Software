import path from "path";
import fs from "fs";
import pino from "pino";
import QRCode from "qrcode";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { prisma } from "../config/prisma";
import { customerService } from "./customerService";

export interface WhatsAppStatus {
  status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  broadcastProgress: {
    isRunning: boolean;
    total: number;
    sent: number;
    failed: number;
  };
}

export class WhatsAppService {
  private sock: any = null;
  private status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED" = "DISCONNECTED";
  private qrDataUrl: string | null = null;
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private authDir: string;
  private isInitializing: boolean = false;

  private broadcastProgress = {
    isRunning: false,
    total: 0,
    sent: 0,
    failed: 0,
  };

  constructor() {
    this.authDir = path.join(process.cwd(), "whatsapp_auth");
  }

  /**
   * Return current service status and QR code if scanning is required
   */
  public getStatus(): WhatsAppStatus {
    return {
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      connectedPhone: this.connectedPhone,
      connectedName: this.connectedName,
      broadcastProgress: { ...this.broadcastProgress },
    };
  }

  /**
   * Initialize or reconnect to WhatsApp Web session
   */
  public async initializeSocket(): Promise<void> {
    if (this.isInitializing || this.status === "CONNECTED") {
      return;
    }

    this.isInitializing = true;
    this.status = "CONNECTING";

    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }) as any,
        printQRInTerminal: false,
        browser: ["Rollz POS", "Chrome", "1.0.0"],
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 25000,
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              width: 300,
              margin: 2,
              color: {
                dark: "#0F172A",
                light: "#FFFFFF",
              },
            });
            this.status = "SCAN_QR";
          } catch (qrErr) {
            console.error("Failed to generate QR data URL:", qrErr);
          }
        }

        if (connection === "open") {
          this.status = "CONNECTED";
          this.qrDataUrl = null;
          const userJid = this.sock?.user?.id || "";
          const phone = userJid.split(":")[0]?.replace(/\D/g, "") || null;
          this.connectedPhone = phone;
          this.connectedName = this.sock?.user?.name || "ROLLZ Official";
          console.log(`[WhatsAppService] Successfully connected to WhatsApp (+${phone})`);
        } else if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(
            `[WhatsAppService] Connection closed. Reason: ${statusCode}, Reconnecting: ${shouldReconnect}`
          );

          this.connectedPhone = null;
          this.connectedName = null;

          if (shouldReconnect) {
            this.status = "CONNECTING";
            setTimeout(() => {
              this.isInitializing = false;
              this.initializeSocket().catch(console.error);
            }, 3000);
          } else {
            this.status = "DISCONNECTED";
            this.qrDataUrl = null;
            this.cleanupAuthDirectory();
          }
        }
      });
    } catch (err) {
      console.error("[WhatsAppService] Initialization error:", err);
      this.status = "DISCONNECTED";
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Log out and wipe stored credentials
   */
  public async logout(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch {
      // Ignore if already disconnected
    }
    this.sock = null;
    this.status = "DISCONNECTED";
    this.qrDataUrl = null;
    this.connectedPhone = null;
    this.connectedName = null;
    this.cleanupAuthDirectory();
  }

  private cleanupAuthDirectory(): void {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error("Failed to delete auth directory:", err);
    }
  }

  /**
   * Send a simple text message to any phone number
   */
  public async sendTextMessage(phone: string, text: string): Promise<boolean> {
    if (this.status !== "CONNECTED" || !this.sock) {
      throw new Error("WhatsApp Web is not connected. Please scan the QR code first.");
    }

    const jid = customerService.toWhatsAppJid(phone);
    await this.sock.sendMessage(jid, { text });
    return true;
  }

  /**
   * Formats and sends automated welcome and receipt message
   */
  public async sendOrderReceiptMessage(params: {
    order: {
      orderNumber: string;
      orderType: string;
      subtotal: number;
      discountTotal: number;
      taxTotal: number;
      grandTotal: number;
      customerName?: string | null;
      customerPhone?: string | null;
      items: Array<{
        itemNameSnapshot: string;
        quantity: number;
        lineTotal: number;
        kitchenNotes?: string | null;
      }>;
    };
    invoice?: {
      invoiceNumber: string;
      createdAt: Date | string;
    } | null;
    branch: {
      name: string;
      phone?: string | null;
      address?: string | null;
    };
    customer?: {
      name: string;
      totalVisits: number;
      totalSpent: number;
    } | null;
    paymentMethod?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { order, invoice, branch, customer, paymentMethod = "PAID" } = params;

    if (!order.customerPhone) {
      return { success: false, error: "No customer phone provided" };
    }

    if (this.status !== "CONNECTED" || !this.sock) {
      return {
        success: false,
        error: "WhatsApp is currently offline. You can share via direct link.",
      };
    }

    try {
      const formattedTotal = (order.grandTotal / 100).toFixed(2);
      const invoiceNum = invoice?.invoiceNumber || order.orderNumber;
      const custName = customer?.name || order.customerName || "Valued Customer";
      const branchName = branch.name || "ROLLZ Fast Food";

      let itemsSummary = "";
      for (const item of order.items) {
        const lineTotal = (item.lineTotal / 100).toFixed(0);
        itemsSummary += `• ${item.quantity}x ${item.itemNameSnapshot} (₹${lineTotal})\n`;
      }

      const totalVisits = customer?.totalVisits || 1;
      const loyaltyBadge =
        totalVisits > 1
          ? `🌟 *Rollz Rewards:* This is your *#${totalVisits} visit*! Thank you for choosing us again!\n\n`
          : `🎉 *Welcome to Rollz family!* We are delighted to serve you!\n\n`;

      const message =
        `🌯 *WELCOME TO ${branchName.toUpperCase()}!* 🌯\n` +
        `_Fresh • Crispy • Handcrafted_\n\n` +
        `Hello *${custName}*, here is your order receipt:\n\n` +
        `🧾 *Invoice:* #${invoiceNum}\n` +
        `📦 *Order No:* #${order.orderNumber} (${order.orderType})\n` +
        `💳 *Mode:* ${paymentMethod}\n` +
        `💰 *Grand Total:* *₹${formattedTotal}*\n\n` +
        `*Items Ordered:*\n` +
        `${itemsSummary}\n` +
        loyaltyBadge +
        `📍 *Location:* ${branch.address || "Rollz Restaurant"}\n` +
        (branch.phone ? `📞 *Support:* ${branch.phone}\n\n` : `\n`) +
        `_Have a delicious meal and visit again soon!_ ❤️`;

      await this.sendTextMessage(order.customerPhone, message);
      return { success: true };
    } catch (err: any) {
      console.error("[WhatsAppService] Failed to send order receipt:", err);
      return { success: false, error: err.message || "Failed to send WhatsApp message" };
    }
  }

  /**
   * Safe bulk broadcast to all customers with rate-limiting (1.5s delay per message)
   */
  public async broadcastToCustomers(params: {
    branchId: string;
    messageText: string;
    minVisits?: number;
  }): Promise<{
    total: number;
    sent: number;
    failed: number;
  }> {
    if (this.status !== "CONNECTED" || !this.sock) {
      throw new Error("WhatsApp is not connected. Please scan QR code first.");
    }

    if (this.broadcastProgress.isRunning) {
      throw new Error("A broadcast campaign is already in progress.");
    }

    const { branchId, messageText, minVisits = 0 } = params;

    const customers = await prisma.customer.findMany({
      where: {
        branchId,
        ...(minVisits > 0 ? { totalVisits: { gte: minVisits } } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (customers.length === 0) {
      return { total: 0, sent: 0, failed: 0 };
    }

    this.broadcastProgress = {
      isRunning: true,
      total: customers.length,
      sent: 0,
      failed: 0,
    };

    // Run broadcast asynchronously with safety delay
    (async () => {
      for (const cust of customers) {
        if (!cust.phone) {
          this.broadcastProgress.failed++;
          continue;
        }

        try {
          // Replace {{name}} placeholder if present
          const personalized = messageText.replace(/{{name}}/gi, cust.name || "Customer");
          await this.sendTextMessage(cust.phone, personalized);
          this.broadcastProgress.sent++;
        } catch (err) {
          console.warn(`[WhatsAppService] Broadcast to ${cust.phone} failed:`, err);
          this.broadcastProgress.failed++;
        }

        // 1.5 second delay between messages to avoid WhatsApp spam detection
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      this.broadcastProgress.isRunning = false;
      console.log(
        `[WhatsAppService] Broadcast finished: ${this.broadcastProgress.sent} sent, ${this.broadcastProgress.failed} failed`
      );
    })().catch((err) => {
      console.error("[WhatsAppService] Broadcast background failure:", err);
      this.broadcastProgress.isRunning = false;
    });

    return {
      total: customers.length,
      sent: 0,
      failed: 0,
    };
  }

  /**
   * Generate wa.me link for direct customer chat or receipt sharing
   */
  public generateDirectWhatsAppLink(phone: string, text: string): string {
    const cleanDigits = customerService.normalizePhone(phone);
    const fullNumber = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const encoded = encodeURIComponent(text);
    return `https://wa.me/${fullNumber}?text=${encoded}`;
  }
}

export const whatsappService = new WhatsAppService();
