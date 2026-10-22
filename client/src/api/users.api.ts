import { apiClient } from "./client";

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  role: "OWNER" | "MANAGER" | "CASHIER";
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const usersApi = {
  listUsers: async (): Promise<StaffUser[]> => {
    const { data } = await apiClient.get<{ success: boolean; users: StaffUser[] }>("/users");
    return data.users;
  },

  createUser: async (payload: {
    username: string;
    displayName: string;
    password: string;
    role?: "CASHIER" | "MANAGER";
  }): Promise<{ success: boolean; user: StaffUser; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; user: StaffUser; message: string }>("/users", payload);
    return data;
  },

  toggleStatus: async (id: string): Promise<{ success: boolean; user: StaffUser; message: string }> => {
    const { data } = await apiClient.patch<{ success: boolean; user: StaffUser; message: string }>(`/users/${id}/status`);
    return data;
  },

  resetPassword: async (id: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(`/users/${id}/reset-password`, {
      newPassword,
    });
    return data;
  },
};
