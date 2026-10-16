import { apiClient } from "./client";
import { Category } from "./categories.api";
import { ModifierGroup } from "./modifiers.api";

export interface MenuItemModifierGroupRel {
  id: string;
  menuItemId: string;
  modifierGroupId: string;
  displayOrder: number;
  isEnabled: boolean;
  modifierGroup: ModifierGroup;
}

export interface MenuItem {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  description: string | null;
  itemCode: string | null;
  imagePath: string | null;
  basePrice: number; // in integer paise
  taxCategory: string;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  category: Category;
  modifierGroups: MenuItemModifierGroupRel[];
  modifierGroupCount?: number;
}

export const menuItemApi = {
  list: async (params?: { categoryId?: string; search?: string; includeInactive?: boolean; isAvailable?: boolean }) => {
    const res = await apiClient.get<{ menuItems: MenuItem[] }>("/menu-items", { params });
    return res.data.menuItems;
  },
  getById: async (id: string) => {
    const res = await apiClient.get<{ menuItem: MenuItem }>(`/menu-items/${id}`);
    return res.data.menuItem;
  },
  create: async (data: {
    categoryId: string;
    name: string;
    description?: string;
    itemCode?: string;
    basePrice: number; // In paise
    taxCategory?: string;
    isAvailable?: boolean;
    isActive?: boolean;
    displayOrder?: number;
    modifierGroupIds?: string[];
  }) => {
    const res = await apiClient.post<{ message: string; menuItem: MenuItem }>("/menu-items", data);
    return res.data;
  },
  update: async (
    id: string,
    data: {
      categoryId?: string;
      name?: string;
      description?: string | null;
      itemCode?: string | null;
      basePrice?: number;
      taxCategory?: string;
      isAvailable?: boolean;
      isActive?: boolean;
      displayOrder?: number;
    }
  ) => {
    const res = await apiClient.patch<{ message: string; menuItem: MenuItem }>(`/menu-items/${id}`, data);
    return res.data;
  },
  toggleAvailability: async (id: string, isAvailable: boolean) => {
    const res = await apiClient.patch<{ message: string; menuItem: MenuItem }>(`/menu-items/${id}/availability`, { isAvailable });
    return res.data;
  },
  toggleStatus: async (id: string, isActive: boolean) => {
    const res = await apiClient.patch<{ message: string; menuItem: MenuItem }>(`/menu-items/${id}/status`, { isActive });
    return res.data;
  },
  assignModifiers: async (id: string, modifierGroupIds: string[]) => {
    const res = await apiClient.put<{ message: string; menuItem: MenuItem }>(`/menu-items/${id}/modifier-groups`, { modifierGroupIds });
    return res.data;
  },
  uploadImage: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await apiClient.post<{ message: string; imagePath: string; menuItem: MenuItem }>(
      `/menu-items/${id}/image`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },
  deleteImage: async (id: string) => {
    const res = await apiClient.delete<{ message: string; menuItem: MenuItem }>(`/menu-items/${id}/image`);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/menu-items/${id}`);
    return res.data;
  },
};
