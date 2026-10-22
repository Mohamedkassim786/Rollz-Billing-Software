import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { customerService } from "../services/customerService";

export const customerRouter = Router();

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(20),
  notes: z.string().trim().max(500).optional(),
});

/**
 * GET /api/customers
 * Paginated list of customers for CRM & Marketing
 */
customerRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || "";

  try {
    const data = await customerService.listCustomers(branchId, page, limit, search);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "CUSTOMER_FETCH_ERROR",
        message: err.message || "Failed to fetch customer list",
      },
    });
  }
});

/**
 * GET /api/customers/search
 * Autocomplete for POS cart input
 */
customerRouter.get("/search", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const query = (req.query.q as string) || "";
  const limit = parseInt(req.query.limit as string) || 8;

  try {
    const customers = await customerService.searchCustomers({
      branchId,
      query,
      limit,
    });
    res.json({ success: true, customers });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "CUSTOMER_SEARCH_ERROR",
        message: err.message || "Failed to search customers",
      },
    });
  }
});

/**
 * GET /api/customers/:id
 * Single customer detail with recent orders
 */
customerRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const customerId = req.params.id;

  try {
    const customer = await customerService.getCustomerById(branchId, customerId);
    if (!customer) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Customer not found" },
      });
      return;
    }
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "CUSTOMER_FETCH_ERROR",
        message: err.message || "Failed to fetch customer details",
      },
    });
  }
});

/**
 * POST /api/customers
 * Upsert or create customer
 */
customerRouter.post("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const branchId = req.user!.branchId;
  const parse = createCustomerSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid customer details",
        details: parse.error.format(),
      },
    });
    return;
  }

  const { name, phone, notes } = parse.data;

  try {
    const customer = await customerService.upsertCustomer({
      branchId,
      name,
      phone,
      notes,
    });
    res.status(201).json({ success: true, customer });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "CUSTOMER_SAVE_ERROR",
        message: err.message || "Failed to save customer",
      },
    });
  }
});
