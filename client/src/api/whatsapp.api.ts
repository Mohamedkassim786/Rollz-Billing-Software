import { apiClient } from "./client";

export interface WhatsAppStatusResponse {
  success: boolean;
  status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  broadcastProgress: {
    isRunning: boolean;
    total: number;
    sent: number;
    failed: number;
  };
}

export interface BroadcastResponse {
  success: boolean;
  message: string;
  total: number;
  sent: number;
  failed: number;
}

export const whatsappApi = {
  getStatus: async (): Promise<WhatsAppStatusResponse> => {
    const { data } = await apiClient.get<WhatsAppStatusResponse>("/whatsapp/status");
    return data;
  },

  initSession: async (): Promise<WhatsAppStatusResponse> => {
    const { data } = await apiClient.post<WhatsAppStatusResponse>("/whatsapp/init");
    return data;
  },

  logoutSession: async (): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>("/whatsapp/logout");
    return data;
  },

  sendMessage: async (phone: string, text: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>("/whatsapp/send", {
      phone,
      text,
    });
    return data;
  },

  broadcast: async (messageText: string, minVisits = 0): Promise<BroadcastResponse> => {
    const { data } = await apiClient.post<BroadcastResponse>("/whatsapp/broadcast", {
      messageText,
      minVisits,
    });
    return data;
  },

  getDirectLink: async (phone: string, text: string): Promise<string> => {
    const { data } = await apiClient.get<{ success: boolean; url: string }>("/whatsapp/direct-link", {
      params: { phone, text },
    });
    return data.url;
  },
};
