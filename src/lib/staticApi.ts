import { getApi } from "./apiClient";

const cacheVersion = "v2";
/**
 * 静态资料在单次浏览会话内只需读取一次。内存层避免切页时重复解析本地缓存，
 * 请求表则避免多个页面同时挂载时重复发起相同接口请求。
 */
const memoryCache = new Map<string, unknown>();
const pendingRequests = new Map<
  string,
  { promise: Promise<unknown>; refresh: boolean }
>();

function cacheKey(name: string) {
  return `yys-cbg-inspector.static.${cacheVersion}.${name}`;
}

async function loadStaticData<T>(
  name: string,
  endpoint: string,
  refresh = false,
) {
  const key = cacheKey(name);

  const pendingRequest = pendingRequests.get(key);
  if (pendingRequest && (!refresh || pendingRequest.refresh)) {
    return pendingRequest.promise as Promise<T>;
  }

  if (!refresh && memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  if (!refresh) {
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) {
        const data = JSON.parse(cached) as T;
        memoryCache.set(key, data);
        return data;
      }
    } catch {
      // 本地缓存不可用时继续请求接口。
    }
  }

  const request = getApi<T>(endpoint)
    .then((data) => {
      memoryCache.set(key, data);
      try {
        window.localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // 缓存空间不足不影响本次数据读取。
      }
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
