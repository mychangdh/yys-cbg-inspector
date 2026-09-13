const staticRefreshStorageKey = "yys-cbg-inspector:static-data-last-refresh-v2";
const staticRefreshIntervalMs = 30 * 24 * 60 * 60 * 1_000;

function readLastRefreshAt() {
  if (typeof window === "undefined") return 0;

  try {
    const value = Number(window.localStorage.getItem(staticRefreshStorageKey));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function getStaticRefreshRemaining() {
  const lastRefreshAt = readLastRefreshAt();
  return lastRefreshAt
    ? Math.max(0, lastRefreshAt + staticRefreshIntervalMs - Date.now())
    : 0;
}

export function getStaticAssetVersion() {
  return String(readLastRefreshAt() || "initial");
}

export function markStaticRefresh() {
  try {
    window.localStorage.setItem(staticRefreshStorageKey, String(Date.now()));
  } catch {
    // Storage failures do not block the refreshed data from being used.
  }
}
