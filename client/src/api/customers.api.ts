import { apiClient } from "./client";

export interface CustomerRecord {
  id: string;
  branchId: string;
  name: string;
  phone: string;
  notes?: string | null;
  totalVisits: number;
  totalSpent: number; // in paise
  lastVisitAt: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    orders: number;
  };
  orders?: Array<{
    id: string;
    orderNumber: string;
    orderType: string;
    grandTotal: number;
    status: string;
    createdAt: string;
  }>;
}

export interface CustomersListResponse {
  success: boolean;
  customers: CustomerRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const customersApi = {
  listCustomers: async (
    page = 1,
    limit = 50,
    search = ""
  ): Promise<CustomersListResponse> => {
    const { data } = await apiClient.get<CustomersListResponse>("/customers", {
      params: { page, limit, search },
    });
    return data;
  },

  searchCustomers: async (query: string): Promise<CustomerRecord[]> => {
    const { data } = await apiClient.get<{ success: boolean; customers: CustomerRecord[] }>(
      "/customers/search",
      { params: { q: query } }
    );
    return data.customers;
  },

  getCustomer: async (id: string): Promise<CustomerRecord> => {
    const { data } = await apiClient.get<{ success: boolean; customer: CustomerRecord }>(
      `/customers/${id}`
    );
    return data.customer;
  },

  createCustomer: async (customerData: {
    name: string;
    phone: string;
    notes?: string;
  }): Promise<CustomerRecord> => {
    const { data } = await apiClient.post<{ success: boolean; customer: CustomerRecord }>(
      "/customers",
      customerData
    );
    return data.customer;
  },
};
