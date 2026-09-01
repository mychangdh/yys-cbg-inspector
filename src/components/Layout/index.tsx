import "./index.scss";
import { useEffect } from "react";
import { ConfigProvider, Layout as AntLayout, message } from "antd";
import { PageNavigation } from "./PageNavigation";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { DatasetHistoryModal } from "@/components/DatasetHistoryModal";
import { MaintenanceModal } from "@/components/MaintenanceModal";
import { ProductLoader } from "@/components/ProductLoader";
import {
  deleteDatasetHistoryRecord,
  clearRecentDatasetSnapshot,
  loadDatasetHistory,
  loadDatasetHistoryRecord,
  loadRecentDatasetSnapshot,
  saveRecentDatasetSnapshot,
  saveRecentDatasetSnapshotOnly,
  emptyDataset,
  incrementCalculatorStaticRefreshRequestId,
  setCacheReady,
  setDataset,
  setHistory,
  setHistoryOpen,
  setProductUrl,
  setRestoreNotice,
  setStaticAssetPreview,
  setStaticDataLoading,
  setUpdating,
  setMaintenanceOpen,
  useAppDispatch,
  useAppSelector,
} from "@/store";
import {
  convertCbgPayloadToDataset,
  extractCbgCollectionSkinCount,
  extractCbgSpeedHighlights,
  parseProductUrl,
} from "@/lib/relics";
import { APP_ROUTE_PATHS, getRouteFromPath, type AppRoute } from "@/router";
import { navigationItems } from "@/router/routes";
import {
  getStaticRefreshRemaining,
  markStaticRefresh,
} from "@/lib/staticRefresh";
import { loadHeroPanels, loadRelicSuits } from "@/lib/staticApi";
import type { GameConfig, RelicDataset } from "@/types";

type HeroStaticPayload = {
  heroesById?: Record<string, { id?: number }>;
};

type RelicSuitStaticPayload = {
  yuhun_list?: Array<[number, ...unknown[]]>;
};

/**
 * 旧缓存没有一速、头尾及准确的典藏皮肤数量。商品已上架后不会变化，因此只在
 * 数据结构升级时补读一次该商品，随后立刻回存，避免每次恢复记录都请求接口。
 */
async function migrateCachedSpeedHighlights(
  dataset: RelicDataset,
  productUrl: string,
) {
  // 版本 11 起御行达摩改为从 damo_count_dict 的物品 ID 411 汇总。
  // 低版本缓存可能把其他货币错误地写成 0，必须回源重新转换一次。
  const needsDarumaMigration = (dataset.schemaVersion || 0) < 11;
  // 旧缓存可能已包含 heroes，但还没有当前页面所需的式神等级字段。
  const hasHeroLevels =
    (dataset.heroes?.length || 0) > 0 &&
    dataset.heroes?.every(
      (hero) => Number.isFinite(hero.level) && hero.level > 0,
    );
  // 桌面端恢复历史记录时只使用本地快照，不再自动请求远程账号数据。
  if (true) {
    return dataset;
  }
  const product = parseProductUrl(productUrl);
  const payload = await window.desktop!.loadProduct({
    serverid: product.serverid,
    ordersn: product.ordersn,
  });
  const gameConfig = {} as GameConfig;
  const refreshedDataset = convertCbgPayloadToDataset(payload, gameConfig);
  return {
    ...refreshedDataset,
    schemaVersion: 11,
    account: {
      ...refreshedDataset.account,
      ...extractCbgSpeedHighlights(payload),
      collectionSkinCount: extractCbgCollectionSkinCount(payload, gameConfig),
      sourceUrl:
        dataset.account?.sourceUrl ||
        refreshedDataset.account?.sourceUrl ||
        product.sourceUrl,
    },
  };
}

export function AppLayout() {
  const dispatch = useAppDispatch();
  const {
    dataset,
    productUrl,
    cacheReady,
    updating,
    history,
    historyOpen,
    staticDataLoading,
    staticAssetPreview,
    restoreNotice,
    maintenanceOpen,
  } = useAppSelector((state) => state.app);
  const [api, holder] = message.useMessage();
  const location = useLocation();
  const navigate = useNavigate();
  const page = getRouteFromPath(location.pathname);
  const hasRelicData = Object.values(dataset.relicsByPosition || {}).some(
    (items) => items.length > 0,
  );
  const hasLoadedProduct = Boolean(dataset.account?.sourceUrl) || hasRelicData;
  const guardedPage =
    page === "maintenance" || page === "about" || hasLoadedProduct
      ? page
      : "home";
  const navigateFromMenu = (route: AppRoute) => {
    navigate(APP_ROUTE_PATHS[route]);
  };
  useEffect(() => {
    // 菜单切换后复位窗口滚动位置，避免新页面沿用上一个页面的阅读位置。
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);
  useEffect(() => {
    return window.desktop?.onOpenMaintenance(() =>
      navigate(APP_ROUTE_PATHS.maintenance),
    );
  }, [navigate]);

  const refreshStaticDataFromMenu = async () => {
    if (staticDataLoading) return;
    if (getStaticRefreshRemaining() > 0) {
      api.info("静态数据仍在冷却中，请稍后再试");
      return;
    }

    dispatch(setStaticDataLoading(true));
    try {
      const [heroData, suitData] = await Promise.all([
        loadHeroPanels<HeroStaticPayload>(true),
        loadRelicSuits<RelicSuitStaticPayload>(true),
      ]);
      const heroIds = Object.values(heroData.heroesById || {})
        .map((hero) => hero.id)
        .filter((id): id is number => Number.isInteger(id) && id > 0);
      const suitIds = (suitData.yuhun_list || [])
        .map(([id]) => id)
        .filter((id): id is number => Number.isInteger(id) && id > 0);
      const assetResult = await window.desktop!.updateStaticAssets({
        heroIds,
        suitIds,
      });
      dispatch(
        setStaticAssetPreview({
          ...assetResult,
          heroIds: heroIds.slice(0, 5),
          suitIds: suitIds.slice(0, 5),
        }),
      );
      markStaticRefresh();
      dispatch(incrementCalculatorStaticRefreshRequestId());
      api.success(
        `静态数据已更新：${assetResult.heroIcons} 个式神图标、${assetResult.suitIcons} 个御魂图标`,
      );
    } catch {
      api.error("静态数据更新失败，请稍后重试");
    } finally {
      dispatch(setStaticDataLoading(false));
    }
  };

  // IndexedDB supports full relic inventories that exceed Safari localStorage limits.
  useEffect(() => {
    let cancelled = false;
    const readyFallbackTimer = window.setTimeout(() => {
      if (!cancelled) dispatch(setCacheReady(true));
    }, 1_500);

    void Promise.all([loadRecentDatasetSnapshot(), loadDatasetHistory()])
      .then(([snapshot, records]) => {
        if (cancelled) return;
        dispatch(setHistory(records));
        if (!snapshot) return;
        dispatch(setDataset(snapshot.dataset));
        dispatch(setRestoreNotice("已恢复上次访问数据"));
        // 仅为旧缓存补齐一次藏宝阁已计算的一速和头尾汇总。
        void migrateCachedSpeedHighlights(
          snapshot.dataset,
          snapshot.productUrl || snapshot.dataset.account?.sourceUrl || "",
        )
          .then(async (migratedDataset) => {
            if (cancelled || migratedDataset === snapshot.dataset) return;
            dispatch(setDataset(migratedDataset));
            await saveRecentDatasetSnapshot(
              migratedDataset,
              snapshot.productUrl,
            );
            const nextHistory = await loadDatasetHistory();
            if (!cancelled) dispatch(setHistory(nextHistory));
          })
          .catch(() => undefined);
        // 将旧版只有“最近一次”的缓存同步到新历史记录表。
        if (
          !records.some((record) => record.productUrl === snapshot.productUrl)
        ) {
          void saveRecentDatasetSnapshot(snapshot.dataset, snapshot.productUrl)
            .then(() => loadDatasetHistory())
            .then((nextHistory) => {
              if (!cancelled) dispatch(setHistory(nextHistory));
            })
            .catch(() => undefined);
        }
      })
      .finally(() => {
        window.clearTimeout(readyFallbackTimer);
        if (!cancelled) dispatch(setCacheReady(true));
      });

    return () => {
      cancelled = true;
      window.clearTimeout(readyFallbackTimer);
    };
  }, [dispatch]);

  // 搜索链接只服务于当前查询，切换功能页面后不保留已输入内容。
  useEffect(() => {
    dispatch(setProductUrl(""));
  }, [dispatch, page]);

  useEffect(() => {
    if (!restoreNotice) return;
    const timer = window.setTimeout(
      () => dispatch(setRestoreNotice(null)),
      4_000,
    );
    return () => window.clearTimeout(timer);
  }, [dispatch, restoreNotice]);

  const refreshHistory = async () => {
    dispatch(setHistory(await loadDatasetHistory()));
  };

  // 弹窗和下拉层打开时锁定背景滚动，桌面端不需要触控事件兼容分支。
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    let lockedScrollY = 0;
    let isScrollLocked = false;

    const setScrollLock = (shouldLock: boolean) => {
      if (shouldLock && !isScrollLocked) {
        lockedScrollY = window.scrollY;
        body.style.position = "fixed";
        body.style.top = `-${lockedScrollY}px`;
        body.style.width = "100%";
        body.style.overflow = "hidden";
        html.style.overflow = "hidden";
        isScrollLocked = true;
        return;
      }

      if (!shouldLock && isScrollLocked) {
        body.style.position = previousBodyPosition;
        body.style.top = previousBodyTop;
        body.style.width = previousBodyWidth;
        body.style.overflow = previousBodyOverflow;
        html.style.overflow = previousHtmlOverflow;
        window.scrollTo(0, lockedScrollY);
        isScrollLocked = false;
      }
    };

    const syncScrollLock = () => {
      const hasOpenSelect = Array.from(
        document.querySelectorAll<HTMLElement>(".ant-select-dropdown"),
      ).some(
        (dropdown) =>
          !dropdown.classList.contains("ant-select-dropdown-hidden"),
      );
      const hasOpenModal = Array.from(
        document.querySelectorAll<HTMLElement>(".ant-modal-wrap"),
      ).some((modal) => {
        const style = window.getComputedStyle(modal);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      const hasFullScreenOverlay = hasOpenModal;
      setScrollLock(hasFullScreenOverlay || hasOpenSelect);
    };

    let scheduledFrame = 0;

    const isScrollLockTarget = (target: Node) => {
      if (target === body) return true;
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest(".ant-select-dropdown, .ant-modal-wrap"));
    };

    const containsScrollLockTarget = (node: Node) => {
      if (!(node instanceof Element)) return false;
      return (
        node.matches(
          ".ant-select-dropdown, .ant-modal-wrap, .ant-drawer-content-wrapper",
        ) ||
        Boolean(
          node.querySelector(
            ".ant-select-dropdown, .ant-modal-wrap, .ant-drawer-content-wrapper",
          ),
        )
      );
    };

    const scheduleSyncScrollLock = () => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = 0;
        syncScrollLock();
      });
    };

    const observer = new MutationObserver((mutations) => {
      const needsSync = mutations.some((mutation) => {
        if (mutation.type === "attributes") {
          return isScrollLockTarget(mutation.target);
        }
        if (mutation.type !== "childList") return false;
        return (
          (mutation.target !== body && isScrollLockTarget(mutation.target)) ||
          Array.from(mutation.addedNodes).some(containsScrollLockTarget) ||
          Array.from(mutation.removedNodes).some(containsScrollLockTarget)
        );
      });
      if (needsSync) scheduleSyncScrollLock();
    });
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden"],
      childList: true,
      subtree: true,
    });
    syncScrollLock();

    return () => {
      observer.disconnect();
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      setScrollLock(false);
    };
  }, []);

  const loadProduct = async () => {
    dispatch(setUpdating(true));
    try {
      const product = parseProductUrl(productUrl);
      const payload = await window.desktop!.loadProduct({
        serverid: product.serverid,
        ordersn: product.ordersn,
      });
      const gameConfig = {} as GameConfig;

      const next = convertCbgPayloadToDataset(payload, gameConfig);
      const loadedDataset: RelicDataset = {
        ...next,
        account: { ...next.account, sourceUrl: product.sourceUrl },
      };

      dispatch(setDataset(loadedDataset));
      dispatch(setProductUrl(""));
      void saveRecentDatasetSnapshot(loadedDataset, product.sourceUrl)
        .then(() => refreshHistory())
        .catch(() => undefined);
      api.success("商品数据已读取并保存到本机浏览器");
    } catch (error) {
      api.error(error instanceof Error ? error.message : "商品数据读取失败");
    } finally {
      dispatch(setUpdating(false));
    }
  };

  const restoreHistory = async (id: string) => {
    dispatch(setUpdating(true));
    try {
      const record = await loadDatasetHistoryRecord(id);
      if (!record) throw new Error("该历史记录已失效，请重新读取账号链接");
      let restoredDataset = record.dataset;
      try {
        restoredDataset = await migrateCachedSpeedHighlights(
          record.dataset,
          record.productUrl || record.dataset.account?.sourceUrl || "",
        );
      } catch {
        // 历史数据已可离线使用，补齐汇总失败时保持原有记录。
      }
      dispatch(setDataset(restoredDataset));
      dispatch(setProductUrl(""));
      await saveRecentDatasetSnapshot(restoredDataset, record.productUrl);
      await refreshHistory();
      dispatch(setRestoreNotice("已恢复历史记录数据"));
    } catch (error) {
      api.error(error instanceof Error ? error.message : "历史记录恢复失败");
    } finally {
      dispatch(setUpdating(false));
    }
  };

  const deleteHistory = async (id: string) => {
    const deletedIndex = history.findIndex((record) => record.id === id);
    const currentSourceUrl = dataset.account?.sourceUrl || productUrl.trim();
    const currentRecord = currentSourceUrl
      ? history.find(
          (record) =>
            record.productUrl === currentSourceUrl ||
            record.dataset.account?.sourceUrl === currentSourceUrl,
        )
      : undefined;
    const deletingCurrentRecord = currentRecord?.id === id;

    await deleteDatasetHistoryRecord(id);
    const nextHistory = await loadDatasetHistory();
    dispatch(setHistory(nextHistory));

    if (!deletingCurrentRecord) return;

    const nextRecord =
      nextHistory[deletedIndex] || nextHistory[deletedIndex - 1] || null;
    if (nextRecord) {
      dispatch(setDataset(nextRecord.dataset));
      dispatch(setProductUrl(nextRecord.productUrl));
      await saveRecentDatasetSnapshotOnly(
        nextRecord.dataset,
        nextRecord.productUrl,
      );
      dispatch(setRestoreNotice("当前账号已删除，已切换到下一个账号。"));
      return;
    }

    dispatch(setDataset(emptyDataset));
    dispatch(setProductUrl(""));
    await clearRecentDatasetSnapshot();
    dispatch(setRestoreNotice("当前账号已删除，已清空本地账号数据。"));
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#c45149",
          borderRadius: 8,
          colorBgLayout: "#f2f3f5",
        },
      }}
    >
      <AntLayout
        className={`app-layout ${hasLoadedProduct ? "shell has-product" : "shell no-product"}`}
      >
        <AntLayout.Content>
          {holder}
          {cacheReady && (
            <>
              <PageNavigation
                guardedPage={guardedPage}
                showNavigation={hasLoadedProduct}
                navigationItems={navigationItems}
                desktopNavigationItems={navigationItems}
                onNavigate={navigateFromMenu}
              />
              <div className="page-route-transition" key={guardedPage}>
                {guardedPage === "home" && (
                  <div className="width overview-loader-wrap">
                    <ProductLoader
                      value={productUrl}
                      loading={updating}
                      history={history}
                      showHistoryTrigger={!hasLoadedProduct}
                      restoreNotice={restoreNotice}
                      onChange={(value) => dispatch(setProductUrl(value))}
                      onLoad={loadProduct}
                      onOpenHistory={() => dispatch(setHistoryOpen(true))}
                    />
                  </div>
                )}
                <Outlet />
              </div>
            </>
          )}
          <DatasetHistoryModal
            open={historyOpen}
            history={history}
            onOpenChange={(open) => dispatch(setHistoryOpen(open))}
            onRestore={(id) => void restoreHistory(id)}
            onDelete={(id) => void deleteHistory(id)}
          />
          <MaintenanceModal
            open={maintenanceOpen}
            loading={staticDataLoading}
            assetPreview={staticAssetPreview}
            onClose={() => dispatch(setMaintenanceOpen(false))}
            onUpdate={refreshStaticDataFromMenu}
          />
        </AntLayout.Content>
      </AntLayout>
    </ConfigProvider>
  );
}
