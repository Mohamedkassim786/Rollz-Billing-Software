import { apiClient } from "./client";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface Ingredient {
  id: string;
  branchId: string;
  name: string;
  sku: string;
  category: string;
  description?: string | null;
  unit: string;
  currentStock: number;
  minThreshold: number;
  costPerUnit: number; // in integer paise
  isActive: boolean;
  stockStatus: StockStatus;
  recipeCount?: number;
  movementCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDashboardSummary {
  totalActiveIngredients: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalWastageCount: number;
  totalInventoryValuation: number; // in paise
  recentMovements: StockMovement[];
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  ingredient: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    category?: string;
  };
  type: "STOCK_IN" | "SALE_DEDUCTION" | "WASTAGE" | "STOCK_ADJUSTMENT" | "REVERSAL";
  quantity: number;
  unit: string;
  stockBefore: number;
  stockAfter: number;
  orderId?: string | null;
  order?: { id: string; orderNumber: string } | null;
  invoiceId?: string | null;
  invoice?: { id: string; invoiceNumber: string } | null;
  user?: { id: string; displayName: string; username: string } | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface StockIntakeRecord {
  id: string;
  ingredientId: string;
  ingredient: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  quantity: number;
  unit: string;
  purchaseCost: number; // in paise
  supplierName?: string | null;
  invoiceRef?: string | null;
  receivedDate: string;
  notes?: string | null;
  user: {
    id: string;
    displayName: string;
  };
  createdAt: string;
}

export interface RecipeItem {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientSku: string;
  ingredientCategory: string;
  recipeQuantity: number;
  recipeUnit: string;
  ingredientUnit: string;
  costPerUnit: number;
  portionCost: number;
  notes?: string | null;
  currentStock: number;
  stockStatus: StockStatus;
}

export interface MenuItemRecipeResponse {
  menuItem: {
    id: string;
    name: string;
    basePrice: number;
    category: string;
  };
  recipeItems: RecipeItem[];
  estimatedCostPaise: number;
}

export const inventoryApi = {
  getDashboard: async (): Promise<InventoryDashboardSummary> => {
    const res = await apiClient.get("/inventory/dashboard");
    return res.data.data;
  },

  getIngredients: async (params?: {
    search?: string;
    category?: string;
    stockStatus?: StockStatus;
    isActive?: boolean;
  }): Promise<Ingredient[]> => {
    const res = await apiClient.get("/inventory/ingredients", { params });
    return res.data.data;
  },

  getIngredientById: async (id: string): Promise<Ingredient> => {
    const res = await apiClient.get(`/inventory/ingredients/${id}`);
    return res.data.data;
  },

  createIngredient: async (data: {
    name: string;
    sku: string;
    category?: string;
    description?: string;
    unit: string;
    currentStock?: number;
    minThreshold?: number;
    costPerUnit?: number;
  }): Promise<Ingredient> => {
    const res = await apiClient.post("/inventory/ingredients", data);
    return res.data.data;
  },

  updateIngredient: async (
    id: string,
    data: {
      name?: string;
      sku?: string;
      category?: string;
      description?: string;
      unit?: string;
      minThreshold?: number;
      costPerUnit?: number;
      isActive?: boolean;
    }
  ): Promise<Ingredient> => {
    const res = await apiClient.patch(`/inventory/ingredients/${id}`, data);
    return res.data.data;
  },

  toggleIngredientStatus: async (id: string, isActive: boolean): Promise<Ingredient> => {
    const res = await apiClient.patch(`/inventory/ingredients/${id}/status`, { isActive });
    return res.data.data;
  },

  recordStockIntake: async (data: {
    ingredientId: string;
    quantity: number;
    unit: string;
    purchaseCost: number;
    supplierName?: string;
    invoiceRef?: string;
    receivedDate?: string;
    notes?: string;
  }): Promise<any> => {
    const res = await apiClient.post("/inventory/intake", data);
    return res.data.data;
  },

  recordWastage: async (data: {
    ingredientId: string;
    quantity: number;
    unit: string;
    reason: string;
    notes?: string;
  }): Promise<any> => {
    const res = await apiClient.post("/inventory/wastage", data);
    return res.data.data;
  },

  recordAdjustment: async (data: {
    ingredientId: string;
    newQuantity: number;
    unit?: string;
    reason: string;
    notes?: string;
  }): Promise<any> => {
    const res = await apiClient.post("/inventory/adjustment", data);
    return res.data.data;
  },

  getMovements: async (params?: {
    ingredientId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ movements: StockMovement[]; pagination: any }> => {
    const res = await apiClient.get("/inventory/movements", { params });
    return res.data.data;
  },

  getIntakes: async (params?: {
    ingredientId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ intakes: StockIntakeRecord[]; pagination: any }> => {
    const res = await apiClient.get("/inventory/intakes", { params });
    return res.data.data;
  },

  getMenuItemRecipe: async (menuItemId: string): Promise<MenuItemRecipeResponse> => {
    const res = await apiClient.get(`/inventory/recipes/menu-items/${menuItemId}`);
    return res.data.data;
  },

  saveMenuItemRecipe: async (
    menuItemId: string,
    items: Array<{ ingredientId: string; quantity: number; unit: string; notes?: string }>
  ): Promise<MenuItemRecipeResponse> => {
    const res = await apiClient.put(`/inventory/recipes/menu-items/${menuItemId}`, { items });
    return res.data.data;
  },
};
