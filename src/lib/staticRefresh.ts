const staticRefreshStorageKey = "yys-cbg-inspector:static-data-last-refresh";
/** 远程数据更新冷却时间，只有用户主动更新时才访问服务器。 */
export const staticRefreshCooldownMs = 30 * 60 * 1_000;

export type StaticRefreshState = {
  lastRefreshAt: number | null;
  remainingMs: number;
};

function readLastRefreshAt() {
  try {
    const value = Number(window.localStorage.getItem(staticRefreshStorageKey));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function getStaticRefreshState(): StaticRefreshState {
  const lastRefreshAt = readLastRefreshAt();
  return {
    lastRefreshAt,
    remainingMs: lastRefreshAt
      ? Math.max(0, lastRefreshAt + staticRefreshCooldownMs - Date.now())
      : 0,
  };
}

export function getStaticRefreshRemaining() {
  return getStaticRefreshState().remainingMs;
}

export function markStaticRefresh() {
  try {
    window.localStorage.setItem(staticRefreshStorageKey, String(Date.now()));
  } catch {
    // Storage failures do not block the refreshed data from being used.
  }
}
