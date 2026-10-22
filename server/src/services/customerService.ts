import { prisma } from "../config/prisma";

export interface UpsertCustomerInput {
  branchId: string;
  name: string;
  phone: string;
  notes?: string;
  orderSpendPaise?: number;
}

export interface CustomerSearchParams {
  branchId: string;
  query?: string;
  limit?: number;
}

export class CustomerService {
  /**
   * Normalizes phone number to clean numeric format (handles +91, 0, spaces, dashes)
   */
  public normalizePhone(rawPhone: string): string {
    if (!rawPhone) return "";
    let clean = rawPhone.replace(/\D/g, "");
    // If 12 digits starting with 91, keep last 10 digits for local standard representation or keep full
    if (clean.length === 12 && clean.startsWith("91")) {
      clean = clean.substring(2);
    } else if (clean.length === 11 && clean.startsWith("0")) {
      clean = clean.substring(1);
    }
    return clean;
  }

  /**
   * Formats phone with country code (defaults to 91 for India) for WhatsApp
   */
  public toWhatsAppJid(rawPhone: string): string {
    const clean = this.normalizePhone(rawPhone);
    const fullNumber = clean.length === 10 ? `91${clean}` : clean;
    return `${fullNumber}@s.whatsapp.net`;
  }

  /**
   * Upsert customer on checkout or manual entry
   */
  public async upsertCustomer(input: UpsertCustomerInput, clientDb?: any) {
    const db = clientDb || prisma;
    const phone = this.normalizePhone(input.phone);
    if (!phone) {
      throw new Error("A valid phone number is required to save customer");
    }

    const cleanName = input.name?.trim() || "Valued Customer";
    const spend = Math.max(0, input.orderSpendPaise || 0);

    // Look for existing customer with same phone in this branch
    const existing = await db.customer.findFirst({
      where: {
        branchId: input.branchId,
        phone,
      },
    });

    if (existing) {
      return db.customer.update({
        where: { id: existing.id },
        data: {
          name: cleanName !== "Valued Customer" ? cleanName : existing.name,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          totalVisits: spend > 0 ? existing.totalVisits + 1 : existing.totalVisits,
          totalSpent: existing.totalSpent + spend,
          lastVisitAt: new Date(),
        },
      });
    }

    return db.customer.create({
      data: {
        branchId: input.branchId,
        name: cleanName,
        phone,
        notes: input.notes || null,
        totalVisits: 1,
        totalSpent: spend,
        lastVisitAt: new Date(),
      },
    });
  }

  /**
   * Quick search for autocomplete in POS cart sidebar
   */
  public async searchCustomers(params: CustomerSearchParams) {
    const { branchId, query, limit = 10 } = params;
    const cleanQuery = query?.trim() || "";

    if (!cleanQuery) {
      return prisma.customer.findMany({
        where: { branchId },
        orderBy: { lastVisitAt: "desc" },
        take: limit,
      });
    }

    const cleanDigits = cleanQuery.replace(/\D/g, "");

    return prisma.customer.findMany({
      where: {
        branchId,
        OR: [
          { name: { contains: cleanQuery, mode: "insensitive" } },
          ...(cleanDigits ? [{ phone: { contains: cleanDigits } }] : []),
        ],
      },
      orderBy: [{ lastVisitAt: "desc" }],
      take: limit,
    });
  }

  /**
   * List all customers with pagination & sorting for CRM view
   */
  public async listCustomers(branchId: string, page = 1, limit = 50, search = "") {
    const skip = (page - 1) * limit;
    const cleanSearch = search.trim();

    const where: any = { branchId };
    if (cleanSearch) {
      const cleanDigits = cleanSearch.replace(/\D/g, "");
      where.OR = [
        { name: { contains: cleanSearch, mode: "insensitive" } },
        ...(cleanDigits ? [{ phone: { contains: cleanDigits } }] : []),
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { lastVisitAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: { orders: true },
          },
        },
      }),
    ]);

    return {
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single customer with order history
   */
  public async getCustomerById(branchId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, branchId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            grandTotal: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }
}

export const customerService = new CustomerService();
