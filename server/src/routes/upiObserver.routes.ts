import { Router, Request, Response } from "express";
import os from "os";
import { prisma } from "../config/prisma";
import { parseBankSms } from "../services/bankSmsParser";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { upiTunnelService } from "../services/upiTunnelService";

export const upiObserverRouter = Router();
const db: any = prisma;

/**
 * POST /api/upi-observer/webhook
 * Public / Token-protected webhook receiver for incoming bank SMS & push notifications.
 * Supports payloads from YouPI Android APK, Tasker, MacroDroid, and SMS-to-URL forwarders.
 */
upiObserverRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const rawBody = req.body || {};
    const rawQuery = req.query || {};

    // 1. Extract message text and sender from varied notification forwarders
    const text: string =
      rawBody.text ||
      rawBody.message ||
      rawBody.body ||
      rawBody.content ||
      rawBody.sms ||
      rawBody.msg ||
      rawBody.notification ||
      (rawBody.data && (rawBody.data.message || rawBody.data.body || rawBody.data.text)) ||
      rawQuery.text ||
      rawQuery.message ||
      rawQuery.body ||
      "";

    const senderHeader: string =
      rawBody.sender ||
      rawBody.from ||
      rawBody.senderHeader ||
      rawBody.title ||
      rawQuery.sender ||
      rawQuery.from ||
      "";

    const providedSecret: string =
      (req.headers["x-upi-secret"] as string) ||
      (req.headers["authorization"] ? req.headers["authorization"].replace(/^Bearer\s+/i, "") : "") ||
      rawBody.secret ||
      rawQuery.secret ||
      "";

    console.log(`[UPI Webhook] Incoming notification received: "${text.substring(0, 80)}" from "${senderHeader}"`);

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing message text in webhook payload" });
      return;
    }

    // 2. Fetch the target branch
    // If a branchId is passed in header/body/query, use it; otherwise use the primary branch
    const targetBranchId =
      (req.headers["x-branch-id"] as string) ||
      rawBody.branchId ||
      rawQuery.branchId;

    let branch = null;
    if (targetBranchId) {
      branch = await db.branch.findUnique({ where: { id: targetBranchId } });
    } else {
      branch = await db.branch.findFirst({ where: { isActive: true } });
    }

    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    // 3. Verify Webhook Secret if configured
    if (branch.upiWebhookSecret && branch.upiWebhookSecret !== "rollz_upi_secret_default") {
      if (providedSecret !== branch.upiWebhookSecret) {
        res.status(401).json({ error: "Unauthorized: Invalid UPI webhook secret" });
        return;
      }
    }

    // 4. Parse the bank SMS using regex parser
    const parsed = parseBankSms(text, senderHeader);
    if (!parsed || !parsed.isCredit) {
      // Ignored (e.g. debit message or spam)
      res.status(200).json({
        success: false,
        message: "Ignored: Not a valid inward UPI credit notification",
        rawText: text.substring(0, 100),
      });
      return;
    }

    // 5. Check if we already processed this UTR to avoid duplicate triggers
    if (parsed.utrNumber) {
      const existingAlert = await db.upiBankAlert.findFirst({
        where: {
          branchId: branch.id,
          utrNumber: parsed.utrNumber,
        },
      });

      if (existingAlert) {
        res.status(200).json({
          success: true,
          message: "Duplicate UTR already recorded",
          alertId: existingAlert.id,
          matched: existingAlert.matched,
          matchedOrderId: existingAlert.matchedOrderId,
        });
        return;
      }
    }

    // 6. Find matching open Order (status DRAFT or HELD with exact grandTotal)
    // Looking for recent orders created or updated in the last 60 minutes
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const candidateOrders = await db.order.findMany({
      where: {
        branchId: branch.id,
        grandTotal: parsed.amountPaise,
        status: { in: ["DRAFT", "HELD"] },
        updatedAt: { gte: sixtyMinutesAgo },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });

    const matchedOrder = candidateOrders.length > 0 ? candidateOrders[0] : null;

    // 7. Save to upi_bank_alerts table
    const alert = await db.upiBankAlert.create({
      data: {
        branchId: branch.id,
        sender: senderHeader || parsed.bankName,
        rawMessage: parsed.rawText,
        amountPaise: parsed.amountPaise,
        utrNumber: parsed.utrNumber,
        payerInfo: parsed.payerInfo,
        matched: !!matchedOrder,
        matchedOrderId: matchedOrder ? matchedOrder.id : null,
      },
    });

    res.status(201).json({
      success: true,
      message: matchedOrder
        ? `Matched with Order #${matchedOrder.orderNumber}`
        : "Recorded alert (Awaiting POS match)",
      alert: {
        id: alert.id,
        amountRupees: parsed.amountRupees,
        amountPaise: parsed.amountPaise,
        utrNumber: parsed.utrNumber,
        bankName: parsed.bankName,
        payerInfo: parsed.payerInfo,
        matched: alert.matched,
        matchedOrderId: alert.matchedOrderId,
        orderNumber: matchedOrder?.orderNumber || null,
      },
    });
  } catch (err: any) {
    console.error("UPI Observer webhook error:", err);
    res.status(500).json({ error: "Failed to process bank notification", details: err.message });
  }
});

/**
 * GET /api/upi-observer/order-status/:orderId
 * Polling endpoint for POS Terminal Payment Modal.
 * Checks if a matching bank credit alert has been recorded for this order in the last 15 minutes.
 */
upiObserverRouter.get("/order-status/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // First check if order is already confirmed
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, grandTotal: true },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.status === "CONFIRMED") {
      res.json({
        isPaid: true,
        orderStatus: order.status,
        message: "Order has already been confirmed",
      });
      return;
    }

    // Check for an unmatched or matched alert for this exact order or amount
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // 1. Alert specifically linked to this order
    let alert = await db.upiBankAlert.findFirst({
      where: {
        matchedOrderId: order.id,
        createdAt: { gte: fifteenMinutesAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Or an unmatched alert with exact amount received recently
    if (!alert) {
      alert = await db.upiBankAlert.findFirst({
        where: {
          matched: false,
          amountPaise: order.grandTotal,
          createdAt: { gte: fifteenMinutesAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      // If found, link it to this order now
      if (alert) {
        alert = await db.upiBankAlert.update({
          where: { id: alert.id },
          data: {
            matched: true,
            matchedOrderId: order.id,
          },
        });
      }
    }

    if (alert) {
      res.json({
        isPaid: true,
        alert: {
          id: alert.id,
          amountPaise: alert.amountPaise,
          amountRupees: alert.amountPaise / 100,
          utrNumber: alert.utrNumber,
          bankName: alert.sender,
          payerInfo: alert.payerInfo,
          createdAt: alert.createdAt,
        },
      });
    } else {
      res.json({
        isPaid: false,
        message: "Awaiting customer payment",
      });
    }
  } catch (err: any) {
    console.error("Error polling order UPI status:", err);
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

/**
 * POST /api/upi-observer/simulate
 * Simulates a bank credit SMS notification for testing without real money.
 */
upiObserverRouter.post("/simulate", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;
    const { amountRupees, orderId, bankName = "HDFC Bank", payerVpa = "customer@okaxis" } = req.body;

    const amount = parseFloat(amountRupees);
    if (isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: "Valid amountRupees is required" });
      return;
    }

    const amountPaise = Math.round(amount * 100);
    const mockUtr = `429${Math.floor(100000000 + Math.random() * 900000000)}`;
    const mockSms = `Dear Customer, your A/C *7860 is credited with Rs ${amount.toFixed(2)} on ${new Date().toLocaleDateString("en-IN")} by UPI/${mockUtr}/${payerVpa}. Avail Bal: Rs 45,210.00 - ${bankName}`;

    // Link directly to orderId if provided
    let matchedOrder = null;
    if (orderId) {
      matchedOrder = await db.order.findUnique({ where: { id: orderId } });
    }

    if (!matchedOrder) {
      matchedOrder = await db.order.findFirst({
        where: {
          branchId,
          grandTotal: amountPaise,
          status: { in: ["DRAFT", "HELD"] },
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    const alert = await db.upiBankAlert.create({
      data: {
        branchId,
        sender: bankName,
        rawMessage: mockSms,
        amountPaise,
        utrNumber: mockUtr,
        payerInfo: payerVpa,
        matched: !!matchedOrder,
        matchedOrderId: matchedOrder ? matchedOrder.id : null,
      },
    });

    res.json({
      success: true,
      message: "Simulated bank payment notification generated successfully!",
      alert,
      simulatedSms: mockSms,
      matchedOrderNumber: matchedOrder?.orderNumber || null,
    });
  } catch (err: any) {
    console.error("Simulation error:", err);
    res.status(500).json({ error: "Failed to simulate payment", details: err.message });
  }
});

/**
 * GET /api/upi-observer/history
 * Lists the last 30 bank alerts received for the branch.
 */
upiObserverRouter.get("/history", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = req.user!.branchId;

    const alerts = await db.upiBankAlert.findMany({
      where: { branchId },
      include: {
        matchedOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            customerName: true,
            customerPhone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    res.json({ alerts });
  } catch (err: any) {
    console.error("Error fetching UPI alert history:", err);
    res.status(500).json({ error: "Failed to fetch alert history" });
  }
});

export const getLocalIpAddress = (): string => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
};

/**
 * GET /api/upi-observer/pairing-info
 * Returns exact pairing payload for the Android APK with secure HTTPS tunnel or local LAN IP
 */
upiObserverRouter.get("/pairing-info", async (_req: Request, res: Response) => {
  try {
    const branch = await db.branch.findFirst({ where: { isActive: true } });
    const localIp = getLocalIpAddress();
    const port = Number(process.env.PORT) || 5000;

    // Check if secure HTTPS tunnel is active, or trigger/wait for it
    let tunnelUrl = upiTunnelService.getTunnelUrl();
    if (!tunnelUrl) {
      tunnelUrl = await upiTunnelService.startTunnel(port);
    }

    const serverUrl = tunnelUrl || `http://${localIp}:${port}`;
    const token = branch?.upiWebhookSecret || "rollz_upi_secret_default";
    const merchantId = branch?.id || "00000000-0000-0000-0000-000000000001";

    res.json({
      type: "YOUPI_SMS_GATEWAY_PAIR",
      version: "v1",
      serverUrl,
      gatewayUrl: serverUrl,
      apiBaseUrl: serverUrl,
      tunnelUrl: tunnelUrl || null,
      localIpUrl: `http://${localIp}:${port}`,
      isSecureTunnel: !!tunnelUrl,
      enrollmentToken: token,
      token,
      merchantId,
      localIp,
      port,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/upi-observer/tunnel/restart
 * Restarts the secure HTTPS tunnel on demand
 */
upiObserverRouter.post("/tunnel/restart", async (_req: Request, res: Response) => {
  try {
    const port = Number(process.env.PORT) || 5000;
    const tunnelUrl = await upiTunnelService.restartTunnel(port);
    res.json({ success: true, tunnelUrl, isSecureTunnel: !!tunnelUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Official YouPI Android APK (Mitto Pay SMS Gateway) Routes:
 * - POST /pollers/android/pair
 * - POST /pollers/android/heartbeat
 * - POST /observers/sms
 * - POST /pollers/android/events
 */
const handleYoupiPair = async (req: Request, res: Response) => {
  try {
    const { deviceName, deviceModel } = req.body || {};
    const branch = await db.branch.findFirst({ where: { isActive: true } });
    const deviceId = `DEV-${Date.now().toString(36)}`;
    const signingKey = branch?.upiWebhookSecret || "rollz_upi_secret_default";

    console.log(`[YouPI APK] Android Device paired: "${deviceName || deviceModel || 'Android'}" (ID: ${deviceId})`);

    res.json({
      paired: true,
      deviceId,
      signingKey,
      merchantId: branch?.id || "00000000-0000-0000-0000-000000000001",
      message: "Android SMS Gateway paired successfully with Rollz POS.",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to pair device: " + err.message });
  }
};

upiObserverRouter.post("/pollers/android/pair", handleYoupiPair);
upiObserverRouter.post("/api/v1/pollers/android/pair", handleYoupiPair);
upiObserverRouter.post("/v1/pollers/android/pair", handleYoupiPair);
upiObserverRouter.post("/observers/sms/pair", handleYoupiPair);
upiObserverRouter.post("/pair", handleYoupiPair);

const handleHeartbeat = (_req: Request, res: Response) => {
  res.json({ status: "alive", timestamp: Date.now() });
};

upiObserverRouter.post("/pollers/android/heartbeat", handleHeartbeat);
upiObserverRouter.post("/api/v1/pollers/android/heartbeat", handleHeartbeat);
upiObserverRouter.post("/v1/pollers/android/heartbeat", handleHeartbeat);

// Ingest SMS from YouPI Android APK: POST /observers/sms
const handleSms = async (req: Request, res: Response) => {
  try {
    const { sender, body, deviceId } = req.body || {};
    console.log(`[YouPI APK SMS] From: ${sender}, Device: ${deviceId}, Body: "${body?.substring(0, 80)}"`);

    if (!body) {
      res.status(400).json({ error: "Empty body" });
      return;
    }

    const branch = await db.branch.findFirst({ where: { isActive: true } });
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    const parsed = parseBankSms(body, sender);
    if (!parsed || !parsed.isCredit) {
      res.json({ accepted: false, message: "Ignored non-credit SMS" });
      return;
    }

    // Deduplication 1: Check by UTR
    if (parsed.utrNumber) {
      const existingAlert = await db.upiBankAlert.findFirst({
        where: {
          branchId: branch.id,
          utrNumber: parsed.utrNumber,
        },
      });
      if (existingAlert) {
        console.log(`[YouPI APK SMS] Duplicate UTR ignored: ${parsed.utrNumber}`);
        res.json({
          accepted: true,
          duplicate: true,
          alertId: existingAlert.id,
          matched: existingAlert.matched,
          matchedOrderId: existingAlert.matchedOrderId,
        });
        return;
      }
    }

    // Deduplication 2: Check by exact rawMessage text in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingMsg = await db.upiBankAlert.findFirst({
      where: {
        branchId: branch.id,
        amountPaise: parsed.amountPaise,
        rawMessage: parsed.rawText,
        createdAt: { gte: fiveMinutesAgo },
      },
    });
    if (existingMsg) {
      console.log(`[YouPI APK SMS] Duplicate message text ignored`);
      res.json({
        accepted: true,
        duplicate: true,
        alertId: existingMsg.id,
        matched: existingMsg.matched,
        matchedOrderId: existingMsg.matchedOrderId,
      });
      return;
    }

    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const candidateOrders = await db.order.findMany({
      where: {
        branchId: branch.id,
        grandTotal: parsed.amountPaise,
        status: { in: ["DRAFT", "HELD"] },
        updatedAt: { gte: sixtyMinutesAgo },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });

    const matchedOrder = candidateOrders.length > 0 ? candidateOrders[0] : null;

    const alert = await db.upiBankAlert.create({
      data: {
        branchId: branch.id,
        sender: sender || parsed.bankName,
        rawMessage: parsed.rawText,
        amountPaise: parsed.amountPaise,
        utrNumber: parsed.utrNumber,
        payerInfo: parsed.payerInfo,
        matched: !!matchedOrder,
        matchedOrderId: matchedOrder?.id || null,
      },
    });

    res.json({
      accepted: true,
      alertId: alert.id,
      matched: alert.matched,
      matchedOrderId: alert.matchedOrderId,
    });
  } catch (err: any) {
    console.error("Error in YouPI APK /observers/sms:", err);
    res.status(500).json({ error: err.message });
  }
};

upiObserverRouter.post("/observers/sms", handleSms);
upiObserverRouter.post("/api/v1/observers/sms", handleSms);
upiObserverRouter.post("/v1/observers/sms", handleSms);

// Ingest App Notification from YouPI Android APK: POST /pollers/android/events
const handleEvents = async (req: Request, res: Response) => {
  try {
    const { amount, bankReferenceNumber, senderVpa, rawNotification, deviceId } = req.body || {};
    const notifText = rawNotification?.text || rawNotification?.title || "";
    console.log(`[YouPI APK Push Alert] Device: ${deviceId}, Amount: ₹${amount}, UTR: ${bankReferenceNumber}, Text: "${notifText}"`);

    const branch = await db.branch.findFirst({ where: { isActive: true } });
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    // Also run our bank SMS parser on notification text to get UTR and payer if missed
    const parsed = parseBankSms(notifText, rawNotification?.package);
    const amtRupees = parseFloat(amount) || (parsed?.amountRupees || 0);
    const amountPaise = amtRupees > 0 ? Math.round(amtRupees * 100) : (parsed?.amountPaise || 0);
    const finalUtr = bankReferenceNumber || parsed?.utrNumber || null;
    const finalPayer = senderVpa || parsed?.payerInfo || null;

    // Deduplication 1: Check by UTR
    if (finalUtr) {
      const existingByUtr = await db.upiBankAlert.findFirst({
        where: {
          branchId: branch.id,
          utrNumber: finalUtr,
        },
      });
      if (existingByUtr) {
        console.log(`[YouPI Push Alert] Duplicate UTR ignored: ${finalUtr}`);
        if (!existingByUtr.payerInfo && finalPayer) {
          await db.upiBankAlert.update({
            where: { id: existingByUtr.id },
            data: { payerInfo: finalPayer },
          });
        }
        res.json({
          accepted: true,
          duplicate: true,
          alertId: existingByUtr.id,
          matched: existingByUtr.matched,
          matchedOrderId: existingByUtr.matchedOrderId,
        });
        return;
      }
    }

    // Deduplication 2: Check by exact notification text in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingMsg = await db.upiBankAlert.findFirst({
      where: {
        branchId: branch.id,
        amountPaise,
        rawMessage: notifText,
        createdAt: { gte: fiveMinutesAgo },
      },
    });
    if (existingMsg) {
      console.log(`[YouPI Push Alert] Duplicate push notification text ignored`);
      if (!existingMsg.utrNumber && finalUtr) {
        await db.upiBankAlert.update({
          where: { id: existingMsg.id },
          data: { utrNumber: finalUtr, payerInfo: finalPayer || existingMsg.payerInfo },
        });
      }
      res.json({
        accepted: true,
        duplicate: true,
        alertId: existingMsg.id,
        matched: existingMsg.matched,
        matchedOrderId: existingMsg.matchedOrderId,
      });
      return;
    }

    // Deduplication 3: If notification is from an SMS app (Google Messages, etc.) and an alert was already logged in last 60s
    const pkg = rawNotification?.package || "";
    const isSmsApp = /messaging|sms|mms/i.test(pkg);
    if (isSmsApp) {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const recentSms = await db.upiBankAlert.findFirst({
        where: {
          branchId: branch.id,
          amountPaise,
          createdAt: { gte: oneMinuteAgo },
        },
      });
      if (recentSms) {
        console.log(`[YouPI Push Alert] Duplicate SMS app notification skipped (already ingested via SMS receiver)`);
        if (!recentSms.utrNumber && finalUtr) {
          await db.upiBankAlert.update({
            where: { id: recentSms.id },
            data: { utrNumber: finalUtr, payerInfo: finalPayer || recentSms.payerInfo },
          });
        }
        res.json({
          accepted: true,
          duplicate: true,
          alertId: recentSms.id,
          matched: recentSms.matched,
          matchedOrderId: recentSms.matchedOrderId,
        });
        return;
      }
    }

    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const candidateOrders = await db.order.findMany({
      where: {
        branchId: branch.id,
        grandTotal: amountPaise,
        status: { in: ["DRAFT", "HELD"] },
        updatedAt: { gte: sixtyMinutesAgo },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });

    const matchedOrder = candidateOrders.length > 0 ? candidateOrders[0] : null;

    const alert = await db.upiBankAlert.create({
      data: {
        branchId: branch.id,
        sender: rawNotification?.package || "UPI Push Notification",
        rawMessage: notifText || `Received Rs ${amount} via UPI`,
        amountPaise,
        utrNumber: finalUtr,
        payerInfo: finalPayer,
        matched: !!matchedOrder,
        matchedOrderId: matchedOrder?.id || null,
      },
    });

    res.json({
      accepted: true,
      alertId: alert.id,
      matched: alert.matched,
      matchedOrderId: alert.matchedOrderId,
    });
  } catch (err: any) {
    console.error("Error in YouPI APK /pollers/android/events:", err);
    res.status(500).json({ error: err.message });
  }
};

upiObserverRouter.post("/pollers/android/events", handleEvents);
upiObserverRouter.post("/api/v1/pollers/android/events", handleEvents);
upiObserverRouter.post("/v1/pollers/android/events", handleEvents);


