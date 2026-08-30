const staticRefreshStorageKey = "yys-cbg-inspector:static-data-last-refresh";
const staticRefreshCooldownMs = 30 * 60 * 1_000;

export function getStaticRefreshRemaining() {
  try {
    const lastRefreshAt = Number(
      window.localStorage.getItem(staticRefreshStorageKey),
    );
    if (!Number.isFinite(lastRefreshAt) || lastRefreshAt <= 0) return 0;
    return Math.max(0, lastRefreshAt + staticRefreshCooldownMs - Date.now());
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
