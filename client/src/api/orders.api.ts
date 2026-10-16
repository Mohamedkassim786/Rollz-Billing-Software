import { apiClient } from "./client";

export interface SelectedModifierInput {
  modifierGroupId: string;
  optionId: string;
}

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  selectedModifiers?: SelectedModifierInput[];
  kitchenNotes?: string;
}

export interface ModifierSnapshot {
  modifierGroupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  extraPrice: number;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  menuItemId: string | null;
  itemNameSnapshot: string;
  basePriceSnapshot: number;
  quantity: number;
  modifierSnapshot: ModifierSnapshot[] | null;
  kitchenNotes: string | null;
  unitPrice: number;
  lineSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface OrderRecord {
  id: string;
  branchId: string;
  orderNumber: string;
  orderType: "TAKEAWAY" | "DINE_IN";
  status: "DRAFT" | "HELD" | "CONFIRMED" | "CANCELLED";
  cashierId: string;
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  subtotal: number;
  discountTotal: number;
  discountType: string | null;
  discountValue: number;
  discountReason: string | null;
  taxTotal: number;
  taxRate: number;
  grandTotal: number;
  items: OrderItemRecord[];
  cashier?: {
    id: string;
    displayName: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CalculationResult {
  items: Array<{
    menuItemId: string;
    itemNameSnapshot: string;
    basePriceSnapshot: number;
    quantity: number;
    modifierSnapshot: ModifierSnapshot[];
    kitchenNotes: string | null;
    unitPrice: number;
    lineSubtotal: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountTotal: number;
  discountType: string | null;
  discountValue: number;
  discountReason: string | null;
  taxTotal: number;
  taxRate: number;
  grandTotal: number;
}

export interface CreateOrderPayload {
  orderType: "TAKEAWAY" | "DINE_IN";
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  items: OrderItemInput[];
  discount?: {
    type: "FIXED" | "PERCENTAGE";
    value: number;
    reason?: string;
  };
  taxRateBasisPoints?: number;
}

export const orderApi = {
  calculate: async (payload: {
    orderType: "TAKEAWAY" | "DINE_IN";
    items: OrderItemInput[];
    discount?: { type: "FIXED" | "PERCENTAGE"; value: number; reason?: string };
    taxRateBasisPoints?: number;
  }) => {
    const res = await apiClient.post<{ calculation: CalculationResult }>("/orders/calculate", payload);
    return res.data.calculation;
  },
  createDraft: async (payload: CreateOrderPayload) => {
    const res = await apiClient.post<{ message: string; order: OrderRecord }>("/orders", payload);
    return res.data.order;
  },
  listOrders: async (params?: { status?: string; orderType?: string; search?: string }) => {
    const res = await apiClient.get<{ orders: OrderRecord[] }>("/orders", { params });
    return res.data.orders;
  },
  getOrder: async (id: string) => {
    const res = await apiClient.get<{ order: OrderRecord }>(`/orders/${id}`);
    return res.data.order;
  },
  updateDraft: async (id: string, payload: Partial<CreateOrderPayload>) => {
    const res = await apiClient.patch<{ message: string; order: OrderRecord }>(`/orders/${id}`, payload);
    return res.data.order;
  },
  holdOrder: async (id: string) => {
    const res = await apiClient.post<{ message: string; order: OrderRecord }>(`/orders/${id}/hold`);
    return res.data.order;
  },
  resumeOrder: async (id: string) => {
    const res = await apiClient.post<{ message: string; order: OrderRecord }>(`/orders/${id}/resume`);
    return res.data.order;
  },
  cancelOrder: async (id: string) => {
    const res = await apiClient.delete<{ message: string; order: OrderRecord }>(`/orders/${id}`);
    return res.data.order;
  },
};
