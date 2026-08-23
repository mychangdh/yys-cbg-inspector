import type {
  AccountOverview,
  HeroView,
  RelicDataset,
  RelicView,
} from "../types";

const databaseName = "yys-cbg-inspector-cache";
const databaseVersion = 2;
const snapshotStoreName = "snapshots";
const historyStoreName = "history";
const snapshotKey = "recent-dataset";
const historyLimit = 10;
const legacyDatasetKey = "yys-cbg-inspector.recent-dataset.v1";
const legacyProductUrlKey = "yys-cbg-inspector.recent-product-url.v1";

export type RecentDatasetSnapshot = {
  dataset: RelicDataset;
  productUrl: string;
  savedAt: number;
};

export type DatasetHistoryRecord = RecentDatasetSnapshot & {
  id: string;
  accountName: string;
  serverName: string;
  relicCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeDexCount(value: unknown) {
  if (!isRecord(value)) return null;
  const owned = numberValue(value.owned);
  const total = numberValue(value.total);
  return owned === undefined || total === undefined ? null : { owned, total };
}

function normalizeAccount(value: unknown): AccountOverview | undefined {
  if (!isRecord(value)) return undefined;
  const dex = isRecord(value.shikigamiDex) ? value.shikigamiDex : undefined;
  const ssr = normalizeDexCount(dex?.ssr);
  const sp = normalizeDexCount(dex?.sp);
  const ur = normalizeDexCount(dex?.ur);
  const uncollected500Days = numberValue(dex?.uncollected500Days);
  const uncollected999Days = numberValue(dex?.uncollected999Days);
  const uncollectedCoupon = numberValue(dex?.uncollectedCoupon);

  return {
    title: textValue(value.title),
    name: textValue(value.name),
    sourceUrl: textValue(value.sourceUrl),
    serverName: textValue(value.serverName),
    level: numberValue(value.level),
    fengzidu: numberValue(value.fengzidu),
    pvpScore: numberValue(value.pvpScore),
    pvpStage: textValue(value.pvpStage) ?? numberValue(value.pvpStage),
    scatteredFirstSpeed: numberValue(value.scatteredFirstSpeed),
    luckyFirstSpeed: numberValue(value.luckyFirstSpeed),
    speedHeadCount: numberValue(value.speedHeadCount),
    speedTailCount: numberValue(value.speedTailCount),
    relicSummary: numberValue(value.relicSummary),
    heroSummary: numberValue(value.heroSummary),
    collectionSkinCount: numberValue(value.collectionSkinCount),
    yuxingDama: numberValue(value.yuxingDama),
    money: numberValue(value.money),
    stamina: numberValue(value.stamina),
    maxLevelRelicCount: numberValue(value.maxLevelRelicCount),
    soulJade: numberValue(value.soulJade),
    mysteryTalisman: numberValue(value.mysteryTalisman),
    realityTalisman: numberValue(value.realityTalisman),
    summonPower: numberValue(value.summonPower),
    ...(ssr && sp && ur && uncollectedCoupon !== undefined
      ? {
          shikigamiDex: {
            ssr,
            sp,
            ur,
            uncollected500Days: uncollected500Days ?? null,
            uncollected999Days: uncollected999Days ?? null,
            uncollectedCoupon,
          },
        }
      : {}),
  };
}

function normalizeHeroes(value: unknown): HeroView[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const heroes = value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const skillLevels = Array.isArray(item.skillLevels)
      ? item.skillLevels
          .map((level) => Number(level) || 0)
          .filter((level) => level > 0)
          .slice(0, 3)
      : [];
    const heroId = Number(item.heroId) || 0;
    if (!heroId || !skillLevels.length) return [];
    return [
      {
        instanceId: textValue(item.instanceId) || String(heroId),
        heroId,
        name: textValue(item.name) || "未知式神",
        rarity: numberValue(item.rarity) || 0,
        level:
          numberValue(item.level) ??
          numberValue(item.lv) ??
          numberValue(item.heroLevel) ??
          numberValue(item.hero_level) ??
          0,
        skillLevels,
      },
    ];
  });
  return heroes.length ? heroes : undefined;
}

// 旧版本的本地数据可能不完整，恢复前先收敛为页面可安全使用的结构。
function normalizeDataset(value: unknown): RelicDataset | null {
  if (!isRecord(value) || !isRecord(value.relicsByPosition)) return null;

  const relicsByPosition = Object.fromEntries(
    Object.entries(value.relicsByPosition).flatMap(([position, relics]) =>
      Array.isArray(relics)
        ? [[position, relics.filter(isRecord) as RelicView[]]]
        : [],
    ),
  );
  const account = normalizeAccount(value.account);
  const heroes = normalizeHeroes(value.heroes);
  const {
    account: _cachedAccount,
    relicsByPosition: _cachedRelicsByPosition,
    ...otherFields
  } = value;

  return {
    ...otherFields,
    ...(account ? { account } : {}),
    ...(heroes ? { heroes } : {}),
    relicsByPosition,
  };
}

function historyId(productUrl: string) {
  const normalizedUrl = productUrl.trim();
  const match = normalizedUrl.match(/\/equip\/([^/?#]+)\/([^/?#]+)/i);
  // 同一商品的推广参数会变化，历史记录只按区服和订单号判重。
  return match
    ? `equip:${match[1]}:${match[2]}`
    : normalizedUrl.replace(/[?#].*$/, "");
}

function createHistoryRecord(
  dataset: RelicDataset,
  productUrl: string,
  savedAt: number,
): DatasetHistoryRecord {
  const canonicalUrl = productUrl.trim() || dataset.account?.sourceUrl || "";
  const relicCount = Object.values(dataset.relicsByPosition).reduce(
    (total, relics) => total + relics.length,
    0,
  );

  return {
    id: historyId(canonicalUrl),
    dataset,
    productUrl: canonicalUrl,
    savedAt,
    accountName:
      dataset.account?.name || dataset.account?.title || "未命名账号",
    serverName: dataset.account?.serverName || "未知服务器",
    relicCount,
  };
}

function openCacheDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(snapshotStoreName)) {
        request.result.createObjectStore(snapshotStoreName);
      }
      if (!request.result.objectStoreNames.contains(historyStoreName)) {
        request.result.createObjectStore(historyStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // 旧标签页仍占用低版本数据库时，不能阻塞整个应用启动。
    request.onblocked = () => reject(new Error("本地缓存数据库正在被占用"));
  });
}

function readLegacySnapshot(): RecentDatasetSnapshot | null {
  try {
    const rawDataset = window.localStorage.getItem(legacyDatasetKey);
    if (!rawDataset) return null;
    const dataset = normalizeDataset(JSON.parse(rawDataset));
    if (!dataset) return null;
    return {
      dataset,
      productUrl:
        dataset.account?.sourceUrl ||
        window.localStorage.getItem(legacyProductUrlKey) ||
        "",
      savedAt: 0,
    };
  } catch {
    return null;
  }
}

function asSnapshot(value: unknown): RecentDatasetSnapshot | null {
  if (!isRecord(value)) return null;
  const dataset = normalizeDataset(value.dataset);
  if (!dataset) return null;
  return {
    dataset,
    productUrl: typeof value.productUrl === "string" ? value.productUrl : "",
    savedAt: Number(value.savedAt) || 0,
  };
}

function asHistoryRecord(value: unknown): DatasetHistoryRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const snapshot = asSnapshot(value);
  if (!snapshot) return null;
  return {
    ...snapshot,
    id: value.id,
    accountName:
      typeof value.accountName === "string"
        ? value.accountName
        : snapshot.dataset.account?.name || "未命名账号",
    serverName:
      typeof value.serverName === "string"
        ? value.serverName
        : snapshot.dataset.account?.serverName || "未知服务器",
    relicCount: Number(value.relicCount) || 0,
  };
}

async function readStoreValue(storeName: string, key: IDBValidKey) {
  const database = await openCacheDatabase();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const request = database
        .transaction(storeName, "readonly")
        .objectStore(storeName)
        .get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function loadRecentDatasetSnapshot() {
  try {
    return asSnapshot(await readStoreValue(snapshotStoreName, snapshotKey));
  } catch {
    return readLegacySnapshot();
  }
}

export async function saveRecentDatasetSnapshotOnly(
  dataset: RelicDataset,
  productUrl: string,
) {
  const normalizedDataset = normalizeDataset(dataset);
  if (!normalizedDataset)
    throw new Error("账号数据格式不完整，无法保存本地快照");

  const snapshot: RecentDatasetSnapshot = {
    dataset: normalizedDataset,
    productUrl: productUrl.trim() || normalizedDataset.account?.sourceUrl || "",
    savedAt: Date.now(),
  };
  const database = await openCacheDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(snapshotStoreName, "readwrite");
      transaction.objectStore(snapshotStoreName).put(snapshot, snapshotKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function clearRecentDatasetSnapshot() {
  try {
    const database = await openCacheDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          snapshotStoreName,
          "readwrite",
        );
        transaction.objectStore(snapshotStoreName).delete(snapshotKey);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  } catch {
    // IndexedDB unavailable; still clear the legacy fallback below.
  }

  try {
    window.localStorage.removeItem(legacyDatasetKey);
    window.localStorage.removeItem(legacyProductUrlKey);
  } catch {
    // Ignore storage access failures.
  }
}

export async function loadDatasetHistory(): Promise<DatasetHistoryRecord[]> {
  try {
    const database = await openCacheDatabase();
    try {
      const records = await new Promise<unknown[]>((resolve, reject) => {
        const request = database
          .transaction(historyStoreName, "readonly")
          .objectStore(historyStoreName)
          .getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      const validRecords = records
        .map(asHistoryRecord)
        .filter((record): record is DatasetHistoryRecord => Boolean(record))
        .sort((left, right) => right.savedAt - left.savedAt);
      const uniqueRecords = new Map<string, DatasetHistoryRecord>();
      validRecords.forEach((record) => {
        const key = historyId(record.productUrl);
        if (!uniqueRecords.has(key)) uniqueRecords.set(key, record);
      });
      return [...uniqueRecords.values()];
    } finally {
      database.close();
    }
  } catch {
    return [];
  }
}

export async function loadDatasetHistoryRecord(id: string) {
  try {
    return asHistoryRecord(await readStoreValue(historyStoreName, id));
  } catch {
    return null;
  }
}

export async function deleteDatasetHistoryRecord(id: string) {
  try {
    const database = await openCacheDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(historyStoreName, "readwrite");
        const request = transaction.objectStore(historyStoreName).delete(id);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  } catch {
    // 删除历史失败不会影响当前正在查看的账号数据。
  }
}

async function removeDuplicateHistoryRecords(
  database: IDBDatabase,
  productUrl: string,
) {
  const identity = historyId(productUrl);
  const records = await new Promise<unknown[]>((resolve, reject) => {
    const request = database
      .transaction(historyStoreName, "readonly")
      .objectStore(historyStoreName)
      .getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  const duplicateIds = records
    .map(asHistoryRecord)
    .filter((record): record is DatasetHistoryRecord => Boolean(record))
    .filter((record) => historyId(record.productUrl) === identity)
    .map((record) => record.id);
  if (!duplicateIds.length) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(historyStoreName, "readwrite");
    const store = transaction.objectStore(historyStoreName);
    duplicateIds.forEach((id) => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function trimDatasetHistory(database: IDBDatabase) {
  const records = await new Promise<DatasetHistoryRecord[]>(
    (resolve, reject) => {
      const request = database
        .transaction(historyStoreName, "readonly")
        .objectStore(historyStoreName)
        .getAll();
      request.onsuccess = () =>
        resolve(
          (request.result || [])
            .map(asHistoryRecord)
            .filter((record): record is DatasetHistoryRecord =>
              Boolean(record),
            ),
        );
      request.onerror = () => reject(request.error);
    },
  );
  const expired = records
    .sort((left, right) => right.savedAt - left.savedAt)
    .slice(historyLimit);
  if (!expired.length) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(historyStoreName, "readwrite");
    const store = transaction.objectStore(historyStoreName);
    expired.forEach((record) => store.delete(record.id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function saveRecentDatasetSnapshot(
  dataset: RelicDataset,
  productUrl: string,
) {
  const normalizedDataset = normalizeDataset(dataset);
  if (!normalizedDataset)
    throw new Error("账号数据格式不完整，无法保存本地记录");

  const savedAt = Date.now();
  const snapshot: RecentDatasetSnapshot = {
    dataset: normalizedDataset,
    productUrl: productUrl.trim(),
    savedAt,
  };
  const historyRecord = createHistoryRecord(
    normalizedDataset,
    snapshot.productUrl,
    savedAt,
  );
  const database = await openCacheDatabase();
  try {
    await removeDuplicateHistoryRecords(database, snapshot.productUrl);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        [snapshotStoreName, historyStoreName],
        "readwrite",
      );
      transaction.objectStore(snapshotStoreName).put(snapshot, snapshotKey);
      transaction.objectStore(historyStoreName).put(historyRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    await trimDatasetHistory(database);
    return historyRecord;
  } finally {
    database.close();
  }
}
