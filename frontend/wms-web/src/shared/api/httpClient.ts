import axios, { type InternalAxiosRequestConfig } from "axios";

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

export function clearAuthSession() {
  localStorage.removeItem("studio-access-token");
  localStorage.removeItem("studio-user");
  window.dispatchEvent(new CustomEvent("auth:signed-out"));
}

export function redirectToLogin() {
  clearAuthSession();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

httpClient.interceptors.request.use((config) => {
  try {
    const tenant = JSON.parse(
      localStorage.getItem("studio-tenant") ?? "{}",
    ) as { businessId?: string; websiteId?: string };
    if (tenant.businessId)
      config.headers.set("X-Business-Id", tenant.businessId);
    if (tenant.websiteId) config.headers.set("X-Website-Id", tenant.websiteId);
  } catch {
    // Ignore invalid JSON in storage
  }
  const token = localStorage.getItem("studio-access-token");
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url ?? "";
    const isAuthEndpoint =
      requestUrl.includes("/api/auth/refresh") ||
      requestUrl.includes("/api/auth/verify-code") ||
      requestUrl.includes("/api/auth/request-code");

    // If 401 happened on refresh or auth endpoint, or already retried once, bail out
    if (isAuthEndpoint || originalRequest._retry) {
      redirectToLogin();
      return Promise.reject(error);
    }

    const existingToken = localStorage.getItem("studio-access-token");
    if (!existingToken) {
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.set("Authorization", `Bearer ${token}`);
          return httpClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    return new Promise((resolve, reject) => {
      httpClient
        .post<{ accessToken?: string; token?: string }>("/api/auth/refresh")
        .then(({ data }) => {
          const newToken = data.accessToken || data.token;
          if (!newToken) {
            throw new Error("No new access token returned by refresh endpoint");
          }
          localStorage.setItem("studio-access-token", newToken);
          originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
          processQueue(null, newToken);
          resolve(httpClient(originalRequest));
        })
        .catch((refreshError) => {
          processQueue(refreshError, null);
          redirectToLogin();
          reject(refreshError);
        })
        .finally(() => {
          isRefreshing = false;
        });
    });
  },
);
