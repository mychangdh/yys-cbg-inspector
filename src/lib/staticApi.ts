import { getApi } from "./apiClient";

const cacheVersion = "v2";

function cacheKey(name: string) {
  return `yys-cbg-inspector.static.${cacheVersion}.${name}`;
}

async function loadStaticData<T>(
  name: string,
  endpoint: string,
  refresh = false,
) {
  const key = cacheKey(name);

  if (!refresh) {
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) return JSON.parse(cached) as T;
    } catch {
      // 本地缓存不可用时继续请求接口。
    }
  }

  const data = await getApi<T>(endpoint);
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // 缓存空间不足不影响本次数据读取。
  }
  return data;
}

export function loadHeroPanels<T = unknown>(refresh = false) {
  return loadStaticData<T>("heroes", "/static/heroes", refresh);
}

export function loadRelicSuits<T = unknown>(refresh = false) {
  return loadStaticData<T>("relic-suits", "/static/relic-suits", refresh);
}
