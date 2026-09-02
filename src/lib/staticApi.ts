import { getApi } from "./apiClient";

type StaticDataName = "heroes" | "relic-suits";

/**
 * 静态资料统一从 NestJS 接口读取。内存层避免切页时重复请求，请求表避免多个页面
 * 同时发起同一请求；接口异常直接交给调用页面处理，不再回退到构建时生成的 JSON。
 */
const memoryCache = new Map<string, unknown>();
const pendingRequests = new Map<
  string,
  { promise: Promise<unknown>; refresh: boolean }
>();

function cacheKey(name: string) {
  return `yys-cbg-inspector.static.${name}`;
}

function isUsableStaticData(name: StaticDataName, data: unknown) {
  if (!data || typeof data !== "object") return false;

  if (name === "heroes") {
    const heroesById = (data as { heroesById?: unknown }).heroesById;
    return Boolean(
      heroesById &&
      typeof heroesById === "object" &&
      Object.keys(heroesById).length > 0,
    );
  }

  const yuhunList = (data as { yuhun_list?: unknown }).yuhun_list;
  return Array.isArray(yuhunList) && yuhunList.length > 0;
}

async function loadStaticData<T>(
  name: StaticDataName,
  endpoint: string,
  refresh = false,
) {
  const key = cacheKey(name);

  const pendingRequest = pendingRequests.get(key);
  if (pendingRequest && (!refresh || pendingRequest.refresh)) {
    return pendingRequest.promise as Promise<T>;
  }

  if (!refresh && memoryCache.has(key)) {
    const cached = memoryCache.get(key);
    if (isUsableStaticData(name, cached)) return cached as T;
    memoryCache.delete(key);
  }

  const request = getApi<T>(endpoint)
    .then((data) => {
      // 数据库故障时 API 可能返回空的临时降级响应，不能交给计算器继续使用。
      if (!isUsableStaticData(name, data)) {
        throw new Error("接口返回的静态资料为空或格式无效");
      }
      memoryCache.set(key, data);
      return data;
    })
    .finally(() => {
      if (pendingRequests.get(key)?.promise === request) {
        pendingRequests.delete(key);
      }
    });

  pendingRequests.set(key, { promise: request, refresh });
  return request;
}

export function loadHeroPanels<T = unknown>(refresh = false) {
  return loadStaticData<T>("heroes", "/static/heroes", refresh);
}

export function loadRelicSuits<T = unknown>(refresh = false) {
  return loadStaticData<T>("relic-suits", "/static/relic-suits", refresh);
}

/**
 * 每月后台向接口请求一次静态资料。使用 allSettled 允许其中一份资料单独更新，
 * 失败不会抛到页面，也不会触发提示。
 */
export async function refreshStaticDataSilently() {
  const results = await Promise.allSettled([
    loadHeroPanels(true),
    loadRelicSuits(true),
  ]);
  return results.some((result) => result.status === "fulfilled");
}
