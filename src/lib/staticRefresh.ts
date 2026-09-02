const staticRefreshStorageKey = "yys-cbg-inspector:static-data-last-refresh-v2";
const staticRefreshIntervalMs = 30 * 24 * 60 * 60 * 1_000;

export function getStaticRefreshRemaining() {
  try {
    const lastRefreshAt = Number(
      window.localStorage.getItem(staticRefreshStorageKey),
    );
    if (!Number.isFinite(lastRefreshAt) || lastRefreshAt <= 0) return 0;
    return Math.max(0, lastRefreshAt + staticRefreshIntervalMs - Date.now());
  } catch {
    return 0;
  }
}

export function markStaticRefresh() {
  try {
    window.localStorage.setItem(staticRefreshStorageKey, String(Date.now()));
  } catch {
    // Storage failures do not block the refreshed data from being used.
  }
}
