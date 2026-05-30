import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

const API = process.env.USE_PROD === "true"
  ? "https://scjym-api.onrender.com/api/v1"
  : (process.env.API_BASE_URL ?? "http://localhost:8000/api/v1");

export function createApiClient(accessToken?: string) {
  return axios.create({
    baseURL: API,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

export async function getServerApiClient() {
  const session = await getServerSession(authOptions);
  return createApiClient((session as any)?.accessToken);
}
