import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { whatsappService } from "../services/whatsappService";

export const whatsappRouter = Router();

const sendTextSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  text: z.string().min(1, "Message text cannot be empty"),
});

const broadcastSchema = z.object({
  messageText: z.string().min(3, "Broadcast message text is required"),
  minVisits: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * GET /api/whatsapp/status
 * Get connection status, QR code data URL, and broadcast progress
 */
whatsappRouter.get("/status", authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  const status = whatsappService.getStatus();
  res.json({ success: true, ...status });
});

/**
 * POST /api/whatsapp/init
 * Initialize socket connection (generates QR if disconnected)
 */
whatsappRouter.post("/init", authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    whatsappService.initializeSocket().catch((err) => {
      console.error("Background WhatsApp init error:", err);
    });
    const status = whatsappService.getStatus();
    res.json({
      success: true,
      message: "WhatsApp session initializing",
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "WHATSAPP_INIT_ERROR",
        message: err.message || "Failed to initialize WhatsApp",
      },
    });
  }
});

/**
 * POST /api/whatsapp/logout
 * Disconnect and clear session
 */
whatsappRouter.post("/logout", authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await whatsappService.logout();
    res.json({
      success: true,
      message: "WhatsApp session logged out and cleared",
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "WHATSAPP_LOGOUT_ERROR",
        message: err.message || "Failed to logout WhatsApp",
      },
    });
  }
});

/**
 * POST /api/whatsapp/send
 * Send single text message
 */
whatsappRouter.post("/send", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const parse = sendTextSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid phone number or message",
        details: parse.error.format(),
      },
    });
    return;
  }

  const { phone, text } = parse.data;

  try {
    await whatsappService.sendTextMessage(phone, text);
    res.json({
      success: true,
      message: "Message dispatched successfully via WhatsApp",
    });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "WHATSAPP_SEND_ERROR",
        message: err.message || "Failed to send message via WhatsApp",
      },
    });
  }
});

/**
 * POST /api/whatsapp/broadcast
 * Bulk send promo / updates to all customers in branch
 */
whatsappRouter.post("/broadcast", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const parse = broadcastSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid broadcast parameters",
        details: parse.error.format(),
      },
    });
    return;
  }

  const { messageText, minVisits } = parse.data;

  try {
    const result = await whatsappService.broadcastToCustomers({
      branchId,
      messageText,
      minVisits,
    });

    res.json({
      success: true,
      message: `Broadcast initiated for ${result.total} customers`,
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "BROADCAST_ERROR",
        message: err.message || "Failed to start broadcast",
      },
    });
  }
});

/**
 * GET /api/whatsapp/direct-link
 * Get wa.me direct link
 */
whatsappRouter.get("/direct-link", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const phone = (req.query.phone as string) || "";
  const text = (req.query.text as string) || "";

  if (!phone) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Phone query param is required" } });
    return;
  }

  const url = whatsappService.generateDirectWhatsAppLink(phone, text);
  res.json({ success: true, url });
});
