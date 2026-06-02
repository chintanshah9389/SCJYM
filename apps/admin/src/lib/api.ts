import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

function getApiMessage(payload: any): string | null {
  const msg =
    payload?.data?.message ??
    payload?.message ??
    payload?.error?.message ??
    payload?.detail?.message ??
    payload?.detail;
  return typeof msg === "string" && msg.trim().length > 0 ? msg : null;
}

const API = process.env.USE_PROD === "true"
  ? "https://scjym-api.onrender.com/api/v1"
  : (process.env.API_BASE_URL ?? "http://localhost:8000/api/v1");

export function createApiClient(accessToken?: string) {
  const client = axios.create({
    baseURL: API,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  client.interceptors.response.use(
    async (response) => {
      if (typeof window !== "undefined") {
        const method = (response.config?.method ?? "get").toLowerCase();
        const shouldToast = ["post", "put", "patch", "delete"].includes(method);
        const suppressToast = response.config?.headers?.["x-no-toast"] === "1";
        if (shouldToast && !suppressToast) {
          const { default: toast } = await import("react-hot-toast");
          toast.success(getApiMessage(response.data) ?? "Request completed successfully");
        }
      }
      return response;
    },
    async (error) => {
      if (typeof window !== "undefined") {
        const { default: toast } = await import("react-hot-toast");
        toast.error(getApiMessage(error?.response?.data) ?? error?.message ?? "Request failed");
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export async function getServerApiClient() {
  const session = await getServerSession(authOptions);
  return createApiClient((session as any)?.accessToken);
}
