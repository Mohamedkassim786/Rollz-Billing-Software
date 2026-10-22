import { apiClient } from "./client";

export interface BranchSettings {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  taxMode: "GST" | "NON_GST";
  defaultTaxRate: number;
  receiptHeader?: string;
  receiptFooter?: string;
  upiId?: string | null;
  upiPayeeName?: string | null;
  tagline?: string | null;
  logoPath?: string | null;
  loginBgPath?: string | null;
  customerPrinterType: string;
  customerPrinterAddress?: string;
  customerPrinterPaperWidth: number;
  customerPrinterEnabled: boolean;
  kitchenPrinterType: string;
  kitchenPrinterAddress?: string;
  kitchenPrinterPaperWidth: number;
  kitchenPrinterEnabled: boolean;
}

export interface HostInfo {
  host: string;
  port: number;
  database: string;
  pgToolsFound: boolean;
  pgBinDir?: string;
}

export interface BackupItem {
  id?: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  status: string;
  error?: string;
}

export interface SettingsResponse {
  branch: BranchSettings;
  hostInfo: HostInfo;
  backups: BackupItem[];
}

export interface UpdateSettingsInput {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  taxMode?: "GST" | "NON_GST";
  defaultTaxRate?: number;
  receiptHeader?: string;
  receiptFooter?: string;
  upiId?: string | null;
  upiPayeeName?: string | null;
  tagline?: string | null;
  logoPath?: string | null;
  loginBgPath?: string | null;
  customerPrinterType?: string;
  customerPrinterAddress?: string;
  customerPrinterPaperWidth?: number;
  customerPrinterEnabled?: boolean;
  kitchenPrinterType?: string;
  kitchenPrinterAddress?: string;
  kitchenPrinterPaperWidth?: number;
  kitchenPrinterEnabled?: boolean;
}

export const settingsApi = {
  getSettings: async (): Promise<SettingsResponse> => {
    const res = await apiClient.get<SettingsResponse>("/settings");
    return res.data;
  },

  updateSettings: async (data: UpdateSettingsInput): Promise<{ message: string; branch: BranchSettings }> => {
    const res = await apiClient.put<{ message: string; branch: BranchSettings }>("/settings", data);
    return res.data;
  },

  uploadLogo: async (file: File): Promise<{ success: boolean; logoPath: string; message: string }> => {
    const formData = new FormData();
    formData.append("logo", file);
    const res = await apiClient.post<{ success: boolean; logoPath: string; message: string }>(
      "/settings/logo",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },

  deleteLogo: async (): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete<{ success: boolean; message: string }>("/settings/logo");
    return res.data;
  },

  uploadLoginBg: async (file: File): Promise<{ success: boolean; loginBgPath: string; message: string }> => {
    const formData = new FormData();
    formData.append("loginBg", file);
    const res = await apiClient.post<{ success: boolean; loginBgPath: string; message: string }>(
      "/settings/login-bg",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },

  deleteLoginBg: async (): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete<{ success: boolean; message: string }>("/settings/login-bg");
    return res.data;
  },

  testPrint: async (destination: "CUSTOMER_RECEIPT" | "KITCHEN"): Promise<{
    success: boolean;
    message: string;
    destination: string;
    adapterName: string;
  }> => {
    const res = await apiClient.post("/settings/printers/test", { destination });
    return res.data;
  },

  recoverPrintQueue: async (): Promise<{ message: string; recoveredCount: number }> => {
    const res = await apiClient.post("/settings/queue/recover");
    return res.data;
  },

  triggerBackup: async (): Promise<{ message: string; backup: BackupItem }> => {
    const res = await apiClient.post("/settings/backup");
    return res.data;
  },

  getBackups: async (): Promise<{ backups: BackupItem[] }> => {
    const res = await apiClient.get("/settings/backups");
    return res.data;
  },

  restoreBackup: async (
    backupFilename: string,
    confirmDatabaseName?: string
  ): Promise<{ success: boolean; message: string; targetDatabase: string; exitCode: number }> => {
    const res = await apiClient.post("/settings/backup/restore", {
      backupFilename,
      confirmDatabaseName,
    });
    return res.data;
  },
};
