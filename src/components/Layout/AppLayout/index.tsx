"use client";

import styles from "./index.module.scss";
import { useEffect, useState, type ReactNode } from "react";
import { shallowEqual } from "react-redux";
import Image from "next/image";
import { getEquipDetailAction } from "@/actions/cbg";
import {
  ConfigProvider,
  Layout as AntLayout,
  message,
  notification,
} from "antd";
import type { ThemeConfig } from "antd";
import { PageNavigation } from "../PageNavigation";
import { usePathname, useRouter } from "next/navigation";
import { DatasetHistoryModal } from "@/components/DatasetHistoryModal";
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
  setMobileMenuOpen,
  setProductUrl,
  setStaticDataLoading,
  setUpdating,
  useAppDispatch,
  useAppSelector,
} from "@/store";
import { parseProductUrl } from "@/lib/relics";
import { toPublicPath } from "@/config/paths";
import { getMenuItem } from "@/config/menu";
import {
  getStaticRefreshRemaining,
  markStaticRefresh,
} from "@/lib/staticRefresh";
import {
  loadHeroPanels,
  loadRelicSuits,
  refreshStaticDataSilently,
} from "@/lib/staticApi";
import type { RelicDataset } from "@/types";
type AppLayoutProps = {
  children: ReactNode;
};

const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#c45149",
    borderRadius: 8,
    colorBgLayout: "#f2f3f5",
  },
};
const PRODUCT_LOCAL_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1_000;

async function loadEquipDetail(
  serverid: string,
  ordersn: string,
): Promise<RelicDataset> {
  const result = await getEquipDetailAction({ serverid, ordersn });

  if (result.validationErrors) {
    throw new Error("商品参数无效");
  }

  if (result.serverError) {
    throw new Error(result.serverError.message);
  }

  if (result.data === undefined) {
    throw new Error("商品数据读取失败");
  }

  if (
    !result.data ||
    typeof result.data !== "object" ||
    !("relicsByPosition" in result.data)
  ) {
    throw new Error("商品数据格式无效");
  }

  return result.data as RelicDataset;
}

/**
 * 旧缓存没有一速和头尾汇总。商品已上架后不会变化，因此只在数据结构升级时
 * 补读一次该商品，随后立刻回存，避免每次恢复记录都请求接口。
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
  if ((hasHeroLevels && !needsDarumaMigration) || !productUrl) {
    return dataset;
  }
  const product = parseProductUrl(productUrl);
  const refreshedDataset = await loadEquipDetail(
    product.serverid,
    product.ordersn,
  );
  return {
    ...refreshedDataset,
    schemaVersion: 11,
    account: {
      ...refreshedDataset.account,
      sourceUrl:
        dataset.account?.sourceUrl ||
        refreshedDataset.account?.sourceUrl ||
        product.sourceUrl,
    },
  };
}

export function AppLayout({ children }: AppLayoutProps) {
  const dispatch = useAppDispatch();
  const {
    dataset,
    productUrl,
    cacheReady,
    updating,
    history,
    historyOpen,
    staticDataLoading,
  } = useAppSelector(
    (state) => ({
      dataset: state.app.dataset,
      productUrl: state.app.productUrl,
      cacheReady: state.app.cacheReady,
      updating: state.app.updating,
      history: state.app.history,
      historyOpen: state.app.historyOpen,
      staticDataLoading: state.app.staticDataLoading,
    }),
    shallowEqual,
  );
  const [api, holder] = message.useMessage();
  const [notificationApi, notificationHolder] = notification.useNotification();
  const [navigationLoading, setNavigationLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const currentMenuItem = getMenuItem(pathname || "/home");
  const page = currentMenuItem.page;
  const hasRelicData = Object.values(dataset.relicsByPosition || {}).some(
    (items) => items.length > 0,
  );
  const hasLoadedProduct = Boolean(dataset.account?.sourceUrl) || hasRelicData;
  const guardedPage = hasLoadedProduct ? page : "home";
  const shouldRedirectToHome =
    cacheReady && currentMenuItem.requiresProduct && !hasLoadedProduct;

  useEffect(() => {
    if (shouldRedirectToHome) {
      const homePath = toPublicPath("/home");
      if (homePath === "/home") {
        router.replace(homePath, { scroll: false });
        return;
      }

      // 生产环境公开路径由 Nginx 提供，使用浏览器级跳转避免 Next.js
      // Next.js 内部不声明公开前缀，不能把浏览器公开地址当成内部路由。
      window.location.replace(homePath);
    }
  }, [router, shouldRedirectToHome]);

  const refreshStaticDataFromMenu = async () => {
    if (staticDataLoading) return;
    if (getStaticRefreshRemaining() > 0) {
      api.info("静态数据仍在冷却中，请稍后再试");
      dispatch(setMobileMenuOpen(false));
      return;
    }

    dispatch(setMobileMenuOpen(false));
    dispatch(setStaticDataLoading(true));
    try {
      await Promise.all([loadHeroPanels(true), loadRelicSuits(true)]);
      markStaticRefresh();
      dispatch(incrementCalculatorStaticRefreshRequestId());
      api.success("静态数据已更新");
    } catch {
      // 远程资料更新失败不影响已缓存的本地资料，也不打扰当前页面。
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
        notificationApi.success({
          message: "已恢复上次访问数据",
          placement: "bottomRight",
          duration: 4,
        });
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
  }, [dispatch, notificationApi]);

  // 静态资料以本地快照为首选；到期后只在后台尝试更新本机缓存，不打断用户。
  // 记录的是“尝试时间”而不是只记录成功时间，避免接口异常时每次切页重复请求。
  useEffect(() => {
    if (getStaticRefreshRemaining() > 0) return;

    let cancelled = false;
    void refreshStaticDataSilently()
      .then((updated) => {
        if (!cancelled && updated) {
          dispatch(incrementCalculatorStaticRefreshRequestId());
        }
      })
      .finally(() => {
        if (!cancelled) markStaticRefresh();
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // 搜索链接只服务于当前查询，切换功能页面后不保留已输入内容。
  useEffect(() => {
    dispatch(setProductUrl(""));
  }, [dispatch, page]);

  const refreshHistory = async () => {
    dispatch(setHistory(await loadDatasetHistory()));
  };

  // 保留弹窗和下拉框的滚动锁定，同时避免监听整个页面内容树。
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
    let isSelectTouchLocked = false;

    const preventSelectBackgroundScroll = (event: TouchEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".ant-select-dropdown")) return;
      event.preventDefault();
    };

    const setSelectTouchLock = (shouldLock: boolean) => {
      if (shouldLock && !isSelectTouchLocked) {
        document.addEventListener("touchmove", preventSelectBackgroundScroll, {
          passive: false,
        });
        isSelectTouchLocked = true;
        return;
      }

      if (!shouldLock && isSelectTouchLocked) {
        document.removeEventListener(
          "touchmove",
          preventSelectBackgroundScroll,
        );
        isSelectTouchLocked = false;
      }
    };

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
      const hasOpenDrawer = Array.from(
        document.querySelectorAll<HTMLElement>(".ant-drawer-content-wrapper"),
      ).some((drawer) => {
        const style = window.getComputedStyle(drawer);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      const hasFullScreenOverlay = hasOpenModal || hasOpenDrawer;
      const shouldUsePageScrollLock =
        hasFullScreenOverlay || (hasOpenSelect && window.innerWidth > 760);

      setScrollLock(shouldUsePageScrollLock);
      setSelectTouchLock(
        hasOpenSelect && !hasFullScreenOverlay && window.innerWidth <= 760,
      );
    };

    let scheduledFrame = 0;

    const scheduleSyncScrollLock = () => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = 0;
        syncScrollLock();
      });
    };

    const overlaySelector =
      ".ant-select-dropdown, .ant-modal-wrap, .ant-drawer-content-wrapper";
    const overlayObserver = new MutationObserver(() => {
      scheduleSyncScrollLock();
    });
    const syncOverlayObservers = () => {
      overlayObserver.disconnect();
      document
        .querySelectorAll<HTMLElement>(overlaySelector)
        .forEach((overlay) => {
          overlayObserver.observe(overlay, {
            attributes: true,
            attributeFilter: ["class", "style", "aria-hidden"],
          });
        });
    };
    const bodyObserver = new MutationObserver(() => {
      syncOverlayObservers();
      scheduleSyncScrollLock();
    });
    bodyObserver.observe(body, {
      childList: true,
    });
    syncOverlayObservers();
    syncScrollLock();

    return () => {
      bodyObserver.disconnect();
      overlayObserver.disconnect();
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      setSelectTouchLock(false);
      setScrollLock(false);
    };
  }, []);

  // 页面使用内部滚动容器，路由切换后主动回到顶部，避免移除 key 后沿用旧页面位置。
  useEffect(() => {
    setNavigationLoading(false);
  }, [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".page-route-transition")
        ?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const loadProduct = async () => {
    dispatch(setUpdating(true));
    try {
      const product = parseProductUrl(productUrl);
      const availableHistory =
        history.length > 0 ? history : await loadDatasetHistory();
      const cacheCutoff = Date.now() - PRODUCT_LOCAL_CACHE_TTL_MS;
      const cachedRecord = availableHistory.find((record) => {
        if (
          record.savedAt <= cacheCutoff ||
          record.dataset.schemaVersion !== 11
        ) {
          return false;
        }

        try {
          const cachedProduct = parseProductUrl(
            record.productUrl || record.dataset.account?.sourceUrl || "",
          );
          return (
            cachedProduct.serverid === product.serverid &&
            cachedProduct.ordersn === product.ordersn
          );
        } catch {
          return false;
        }
      });

      if (cachedRecord) {
        dispatch(setDataset(cachedRecord.dataset));
        dispatch(setProductUrl(""));
        api.success("商品数据读取成功");
        return;
      }

      const next = await loadEquipDetail(product.serverid, product.ordersn);
      const loadedDataset: RelicDataset = {
        ...next,
        account: { ...next.account, sourceUrl: product.sourceUrl },
      };

      dispatch(setDataset(loadedDataset));
      dispatch(setProductUrl(""));
      void saveRecentDatasetSnapshot(loadedDataset, product.sourceUrl)
        .then(() => refreshHistory())
        .catch(() => undefined);
      api.success("商品数据读取成功");
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
      notificationApi.success({
        message: "已恢复历史记录数据",
        placement: "bottomRight",
        duration: 4,
      });
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
      notificationApi.info({
        message: "当前账号已删除，已切换到下一个账号。",
        placement: "bottomRight",
        duration: 4,
      });
      return;
    }

    dispatch(setDataset(emptyDataset));
    dispatch(setProductUrl(""));
    await clearRecentDatasetSnapshot();
    notificationApi.info({
      message: "当前账号已删除，已清空本地账号数据。",
      placement: "bottomRight",
      duration: 4,
    });
  };

  return (
    <ConfigProvider theme={appTheme}>
      <AntLayout
        className={`${styles.appLayout} ${hasLoadedProduct ? "shell has-product" : "shell no-product"}`}
      >
        <AntLayout.Content>
          {holder}
          {notificationHolder}
          {cacheReady && (
            <>
              <PageNavigation
                guardedPage={guardedPage}
                showNavigation={hasLoadedProduct}
                onRefreshStaticData={refreshStaticDataFromMenu}
                onNavigationStart={() => setNavigationLoading(true)}
              />
              <div
                className={`page-route-transition${navigationLoading ? " is-navigating" : ""}`}
                aria-busy={navigationLoading}
              >
                {guardedPage === "home" && (
                  <div className="width overview-loader-wrap">
                    <ProductLoader
                      value={productUrl}
                      loading={updating}
                      history={history}
                      showHistoryTrigger={!hasLoadedProduct}
                      onChange={(value) => dispatch(setProductUrl(value))}
                      onLoad={loadProduct}
                      onOpenHistory={() => dispatch(setHistoryOpen(true))}
                    />
                  </div>
                )}
                {!shouldRedirectToHome && children}
                <footer className="site-footer">
                  <a
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    鲁ICP备2026050817号-1 
                  </a> 
                  <span className="site-footer-public-security">
                    <Image
                      className="site-footer-icon"
                      src={toPublicPath("/beian-icon.png")}
                      alt=""
                      width={16}
                      height={16}
                      aria-hidden="true"
                    />
                    <a
                      href="https://beian.mps.gov.cn/#/query/webSearch?code=37050202371677"
                      target="_blank"
                      rel="noreferrer"
                    >
                      鲁公网安备37050202371677号
                    </a>
                  </span>
                </footer>
              </div>
            </>
          )}
          {navigationLoading && (
            <div
              className="page-navigation-progress"
              role="status"
              aria-label="正在切换页面"
            />
          )}
          <DatasetHistoryModal
            open={historyOpen}
            history={history}
            onOpenChange={(open) => dispatch(setHistoryOpen(open))}
            onRestore={(id) => void restoreHistory(id)}
            onDelete={(id) => void deleteHistory(id)}
          />
        </AntLayout.Content>
      </AntLayout>
    </ConfigProvider>
  );
}
