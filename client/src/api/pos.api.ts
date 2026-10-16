import { apiClient } from "./client";

export interface POSCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  displayOrder: number;
  isActive: boolean;
  availableItemCount: number;
}

export interface POSModifierOption {
  id: string;
  name: string;
  description: string | null;
  extraPrice: number; // in paise
  isAvailable: boolean;
}

export interface POSModifierGroup {
  id: string;
  name: string;
  description: string | null;
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: POSModifierOption[];
}

export interface POSMenuItem {
  id: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  name: string;
  description: string | null;
  itemCode: string | null;
  imagePath: string | null;
  basePrice: number; // in paise
  taxCategory: string;
  isAvailable: boolean;
  modifierGroups: POSModifierGroup[];
}

export const posApi = {
  getCategories: async () => {
    const res = await apiClient.get<{ categories: POSCategory[] }>("/pos/categories");
    return res.data.categories;
  },
  getMenuItems: async (params?: { categoryId?: string; search?: string }) => {
    const res = await apiClient.get<{ menuItems: POSMenuItem[] }>("/pos/menu-items", { params });
    return res.data.menuItems;
  },
  getMenuItemById: async (id: string) => {
    const res = await apiClient.get<{ menuItem: POSMenuItem }>(`/pos/menu-items/${id}`);
    return res.data.menuItem;
  },
};
