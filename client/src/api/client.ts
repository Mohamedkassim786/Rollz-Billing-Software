import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("rollz_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect if checking auth status
      if (!error.config.url?.includes("/auth/status")) {
        localStorage.removeItem("rollz_auth_token");
        localStorage.removeItem("rollz_auth_user");
      }
    }
    return Promise.reject(error);
  }
);
