import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

if (!configuredApiBaseUrl) {
  throw new Error(
    "缺少 NEXT_PUBLIC_API_BASE_URL，请在构建前配置完整的 API 地址。",
  );
}

export const apiClient = axios.create({
  baseURL: configuredApiBaseUrl.replace(/\/$/, ""),
  timeout: 20_000,
});

function toRequestError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error("接口请求失败");
  }

  const payload = error.response?.data;
  const backendMessage =
    payload && typeof payload === "object" && "msg" in payload
      ? String(payload.msg)
      : payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : undefined;
  const message = backendMessage || error.message || "接口请求失败";
  const status = error.response?.status;

  return new Error(status ? `${message}（HTTP ${status}）` : message);
}

async function unwrap<T>(request: Promise<AxiosResponse<T>>) {
  try {
    return (await request).data;
  } catch (error) {
    throw toRequestError(error);
  }
}

export function getApi<T>(
  url: string,
  config?: Omit<AxiosRequestConfig, "url" | "method">,
) {
  return unwrap(apiClient.get<T>(url, config));
}
