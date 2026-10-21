import { apiClient } from "./client";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: "OWNER" | "MANAGER" | "CASHIER";
  branchId: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  taxMode?: "GST" | "NON_GST";
  gstin?: string | null;
  upiId?: string | null;
  upiPayeeName?: string | null;
}

export interface AuthResponse {
  message: string;
  user: User;
  branch: Branch;
  token: string;
}

export const authApi = {
  getStatus: async () => {
    const res = await apiClient.get<{ isOwnerSetup: boolean }>("/auth/status");
    return res.data;
  },
  setupOwner: async (data: { username: string; password: string; displayName: string }) => {
    const res = await apiClient.post<AuthResponse>("/auth/setup-owner", data);
    return res.data;
  },
  login: async (data: { username: string; password: string }) => {
    const res = await apiClient.post<AuthResponse>("/auth/login", data);
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get<{ user: User; branch: Branch }>("/auth/me");
    return res.data;
  },
};
