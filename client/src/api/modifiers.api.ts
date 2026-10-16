import { apiClient } from "./client";

export interface ModifierOption {
  id: string;
  modifierGroupId: string;
  name: string;
  description: string | null;
  extraPrice: number; // In paise
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface ModifierGroup {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  isActive: boolean;
  itemCount: number;
  options: ModifierOption[];
}

export const modifierApi = {
  listGroups: async (params?: { includeInactive?: boolean }) => {
    const res = await apiClient.get<{ modifierGroups: ModifierGroup[] }>("/modifier-groups", { params });
    return res.data.modifierGroups;
  },
  getGroup: async (id: string) => {
    const res = await apiClient.get<{ modifierGroup: ModifierGroup }>(`/modifier-groups/${id}`);
    return res.data.modifierGroup;
  },
  createGroup: async (data: {
    name: string;
    description?: string;
    selectionType: "SINGLE" | "MULTIPLE";
    isRequired?: boolean;
    minSelections?: number;
    maxSelections?: number;
    isActive?: boolean;
  }) => {
    const res = await apiClient.post<{ message: string; modifierGroup: ModifierGroup }>("/modifier-groups", data);
    return res.data;
  },
  updateGroup: async (
    id: string,
    data: {
      name?: string;
      description?: string | null;
      selectionType?: "SINGLE" | "MULTIPLE";
      isRequired?: boolean;
      minSelections?: number;
      maxSelections?: number;
      isActive?: boolean;
    }
  ) => {
    const res = await apiClient.patch<{ message: string; modifierGroup: ModifierGroup }>(`/modifier-groups/${id}`, data);
    return res.data;
  },
  toggleGroupStatus: async (id: string, isActive: boolean) => {
    const res = await apiClient.patch<{ message: string; modifierGroup: ModifierGroup }>(`/modifier-groups/${id}/status`, { isActive });
    return res.data;
  },
  deleteGroup: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/modifier-groups/${id}`);
    return res.data;
  },
  addOption: async (
    groupId: string,
    data: {
      name: string;
      description?: string;
      extraPrice: number; // in paise
      isAvailable?: boolean;
      isActive?: boolean;
      displayOrder?: number;
    }
  ) => {
    const res = await apiClient.post<{ message: string; option: ModifierOption }>(`/modifier-groups/${groupId}/options`, data);
    return res.data;
  },
  updateOption: async (
    optionId: string,
    data: {
      name?: string;
      description?: string | null;
      extraPrice?: number;
      isAvailable?: boolean;
      isActive?: boolean;
      displayOrder?: number;
    }
  ) => {
    const res = await apiClient.patch<{ message: string; option: ModifierOption }>(`/modifier-groups/options/${optionId}`, data);
    return res.data;
  },
  toggleOptionStatus: async (optionId: string, data: { isActive?: boolean; isAvailable?: boolean }) => {
    const res = await apiClient.patch<{ message: string; option: ModifierOption }>(`/modifier-groups/options/${optionId}/status`, data);
    return res.data;
  },
  deleteOption: async (optionId: string) => {
    const res = await apiClient.delete<{ message: string }>(`/modifier-groups/options/${optionId}`);
    return res.data;
  },
};
