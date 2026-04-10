import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

type RequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const axiosApi = axios.create({
  baseURL: "",
});

axiosApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<void> | null = null;

function refreshAccessToken(): Promise<void> {
  const refresh = getRefreshToken();
  if (!refresh) {
    return Promise.reject(new Error("No refresh token"));
  }
  return axios
    .post<{ access: string }>("/api/auth/refresh", { refresh })
    .then((res) => {
      localStorage.setItem(ACCESS_KEY, res.data.access);
    });
}

axiosApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RequestConfig | undefined;
    const status = error.response?.status;

    if (!config || status !== 401) {
      return Promise.reject(error);
    }

    const url = String(config.url ?? "");
    if (
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/register") ||
      url.includes("/api/auth/password-reset/")
    ) {
      return Promise.reject(error);
    }
    if (url.includes("/api/auth/refresh")) {
      clearTokens();
      return Promise.reject(error);
    }
    if (config._retry) {
      clearTokens();
      return Promise.reject(error);
    }
    if (!getRefreshToken()) {
      clearTokens();
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      const token = getAccessToken();
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
      return axiosApi.request(config);
    } catch {
      clearTokens();
      return Promise.reject(error);
    }
  },
);

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> =>
  axiosApi(config as InternalAxiosRequestConfig).then(({ data }) => data as T);

export default customInstance;
