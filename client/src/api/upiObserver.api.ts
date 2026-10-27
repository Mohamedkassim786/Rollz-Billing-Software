import { apiClient } from "./client";

export interface UpiBankAlertRecord {
  id: string;
  amountPaise: number;
  amountRupees: number;
  utrNumber: string | null;
  bankName: string | null;
  payerInfo: string | null;
  createdAt: string;
  matched?: boolean;
  matchedOrderId?: string | null;
  rawMessage?: string;
}

export interface UpiOrderStatusResponse {
  isPaid: boolean;
  orderStatus?: string;
  message?: string;
  alert?: UpiBankAlertRecord;
}

export const upiObserverApi = {
  /**
   * Poll whether a matching bank SMS / UPI credit has been received for the order
   */
  async checkOrderStatus(orderId: string): Promise<UpiOrderStatusResponse> {
    const res = await apiClient.get<UpiOrderStatusResponse>(`/upi-observer/order-status/${orderId}`);
    return res.data;
  },

  /**
   * Simulate an incoming bank credit SMS notification for testing
   */
  async simulatePayment(params: {
    amountRupees: number;
    orderId?: string;
    bankName?: string;
    payerVpa?: string;
  }) {
    const res = await apiClient.post("/upi-observer/simulate", params);
    return res.data;
  },

  /**
   * Fetch recent bank credit alerts
   */
  async getHistory(): Promise<{ alerts: UpiBankAlertRecord[] }> {
    const res = await apiClient.get("/upi-observer/history");
    return res.data;
  },
};
