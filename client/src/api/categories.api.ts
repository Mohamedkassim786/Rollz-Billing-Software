import { apiClient } from "./client";

export interface Category {
  id: string;
  branchId: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export const categoryApi = {
  list: async (params?: { includeInactive?: boolean; search?: string }) => {
    const res = await apiClient.get<{ categories: Category[] }>("/categories", { params });
    return res.data.categories;
  },
  getById: async (id: string) => {
    const res = await apiClient.get<{ category: Category }>(`/categories/${id}`);
    return res.data.category;
  },
  create: async (data: { name: string; description?: string; displayOrder?: number; isActive?: boolean }) => {
    const res = await apiClient.post<{ message: string; category: Category }>("/categories", data);
    return res.data;
  },
  update: async (id: string, data: { name?: string; description?: string | null; displayOrder?: number; isActive?: boolean }) => {
    const res = await apiClient.patch<{ message: string; category: Category }>(`/categories/${id}`, data);
    return res.data;
  },
  toggleStatus: async (id: string, isActive: boolean) => {
    const res = await apiClient.patch<{ message: string; category: Category }>(`/categories/${id}/status`, { isActive });
    return res.data;
  },
  reorder: async (items: Array<{ id: string; displayOrder: number }>) => {
    const res = await apiClient.patch<{ message: string }>("/categories/reorder", { items });
    return res.data;
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/categories/${id}`);
    return res.data;
  },
};
