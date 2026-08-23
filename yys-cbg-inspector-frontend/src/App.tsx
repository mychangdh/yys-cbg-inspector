import "./App.scss";
import { useEffect, useState } from "react";
import {
  AppstoreOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  HistoryOutlined,
  HomeOutlined,
  MenuOutlined,
  FundProjectionScreenOutlined,
  ReloadOutlined,
  StarOutlined,
} from "@ant-design/icons";
import { ConfigProvider, Drawer, Layout, message } from "antd";
import {
  DatasetHistoryModal,
  ProductLoader,
} from "./components/ProductLoader/ProductLoader";
import { getApi } from "./lib/apiClient";
import {
  deleteDatasetHistoryRecord,
  clearRecentDatasetSnapshot,
  loadDatasetHistory,
  loadDatasetHistoryRecord,
  loadRecentDatasetSnapshot,
  saveRecentDatasetSnapshot,
  saveRecentDatasetSnapshotOnly,
  type DatasetHistoryRecord,
} from "./lib/recentDatasetCache";
import {
  convertCbgPayloadToDataset,
  extractCbgCollectionSkinCount,
  extractCbgSpeedHighlights,
  parseProductUrl,
} from "./lib/relics";
import { useAppRouter } from "./lib/router";
import {
  getStaticRefreshRemaining,
  markStaticRefresh,
} from "./lib/staticRefresh";
import {
  loadHeroPanels,
  loadRelicSuits,
} from "./lib/staticApi";
import { CalculatorWorkspace } from "./pages/CalculatorPage/CalculatorWorkspace";
import { OverviewPage } from "./pages/OverviewPage/OverviewPage";
import { RelicsPage } from "./pages/RelicsPage/RelicsPage";
import { SpeedPage } from "./pages/SpeedPage/SpeedPage";
import { PvePage } from "./pages/PvePage/PvePage";
import { HeroSkillsPage } from "./pages/HeroSkillsPage/HeroSkillsPage";
import type { RelicDataset, RelicSuitConfig } from "./types";

const emptyDataset: RelicDataset = { relicsByPosition: {} };

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
  if ((hasHeroLevels && !needsDarumaMigration) || !productUrl) {
    return dataset;
  }
  const product = parseProductUrl(productUrl);
  const [payload, relicSuitConfig] = await Promise.all([
    getApi<unknown>("/cbg/get_equip_detail", {
      params: { serverid: product.serverid, ordersn: product.ordersn },
    }),
    loadRelicSuits<RelicSuitConfig>(),
  ]);
  const refreshedDataset = convertCbgPayloadToDataset(payload, relicSuitConfig);
  return {
    ...refreshedDataset,
    schemaVersion: 11,
    account: {
      ...refreshedDataset.account,
      ...extractCbgSpeedHighlights(payload),
      collectionSkinCount: extractCbgCollectionSkinCount(payload),
      sourceUrl:
        dataset.account?.sourceUrl ||
        refreshedDataset.account?.sourceUrl ||
        product.sourceUrl,
    },
  };
}

const navigationItems = [
  { route: "overview", label: "账号查询", icon: <HomeOutlined /> },
  { route: "speed", label: "速度盘点", icon: <DashboardOutlined /> },
  { route: "pve", label: "PVE 预览", icon: <FundProjectionScreenOutlined /> },
  { route: "hero-skills", label: "式神技能", icon: <StarOutlined /> },
  { route: "calculator", label: "御魂计算器", icon: <CalculatorOutlined /> },
  { route: "relics", label: "御魂库存", icon: <AppstoreOutlined /> },
] as const;

export function App() {
  const [dataset, setDataset] = useState<RelicDataset>(emptyDataset);
  const [productUrl, setProductUrl] = useState("");
  const [cacheReady, setCacheReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [history, setHistory] = useState<DatasetHistoryRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [staticDataLoading, setStaticDataLoading] = useState(false);
  const [
    calculatorStaticRefreshRequestId,
    setCalculatorStaticRefreshRequestId,
  ] = useState(0);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const [api, holder] = message.useMessage();
  const { route: page, navigate } = useAppRouter();
  const hasRelicData = Object.values(dataset.relicsByPosition || {}).some(
    (items) => items.length > 0,
  );
  const hasLoadedProduct = Boolean(dataset.account?.sourceUrl) || hasRelicData;
  const guardedPage = hasLoadedProduct ? page : "overview";
  const currentNavigation = navigationItems.find(
    (item) => item.route === guardedPage,
  )!;

  const navigateFromMenu = (route: typeof guardedPage) => {
    setMobileMenuOpen(false);
    navigate(route);
  };

  const refreshStaticDataFromMenu = async () => {
    if (staticDataLoading) return;
    if (getStaticRefreshRemaining() > 0) {
      api.info("静态数据仍在冷却中，请稍后再试");
      setMobileMenuOpen(false);
      return;
    }

    setMobileMenuOpen(false);
    setStaticDataLoading(true);
    try {
      await Promise.all([loadHeroPanels(true), loadRelicSuits(true)]);
      markStaticRefresh();
      setCalculatorStaticRefreshRequestId((current) => current + 1);
      api.success("静态数据已更新");
    } catch {
      api.error("静态数据更新失败，请稍后重试");
    } finally {
      setStaticDataLoading(false);
    }
  };

  // IndexedDB supports full relic inventories that exceed Safari localStorage limits.
  useEffect(() => {
    let cancelled = false;
    const readyFallbackTimer = window.setTimeout(() => {
      if (!cancelled) setCacheReady(true);
    }, 1_500);

    void Promise.all([loadRecentDatasetSnapshot(), loadDatasetHistory()])
      .then(([snapshot, records]) => {
        if (cancelled) return;
        setHistory(records);
        if (!snapshot) return;
        setDataset(snapshot.dataset);
        setRestoreNotice("已恢复上次访问数据");
        // 仅为旧缓存补齐一次藏宝阁已计算的一速和头尾汇总。
        void migrateCachedSpeedHighlights(
          snapshot.dataset,
          snapshot.productUrl || snapshot.dataset.account?.sourceUrl || "",
        )
          .then(async (migratedDataset) => {
            if (cancelled || migratedDataset === snapshot.dataset) return;
            setDataset(migratedDataset);
            await saveRecentDatasetSnapshot(
              migratedDataset,
              snapshot.productUrl,
            );
            const nextHistory = await loadDatasetHistory();
            if (!cancelled) setHistory(nextHistory);
          })
          .catch(() => undefined);
        // 将旧版只有“最近一次”的缓存同步到新历史记录表。
        if (
          !records.some((record) => record.productUrl === snapshot.productUrl)
        ) {
          void saveRecentDatasetSnapshot(snapshot.dataset, snapshot.productUrl)
            .then(() => loadDatasetHistory())
            .then((nextHistory) => {
              if (!cancelled) setHistory(nextHistory);
            })
            .catch(() => undefined);
        }
      })
      .finally(() => {
        window.clearTimeout(readyFallbackTimer);
        if (!cancelled) setCacheReady(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(readyFallbackTimer);
    };
  }, []);

  // 搜索链接只服务于当前查询，切换功能页面后不保留已输入内容。
  useEffect(() => {
    setProductUrl("");
  }, [page]);

  useEffect(() => {
    if (!restoreNotice) return;
    const timer = window.setTimeout(() => setRestoreNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [restoreNotice]);

  const refreshHistory = async () => {
    setHistory(await loadDatasetHistory());
  };

  // Keep the page behind menus and overlays still without moving the mobile
  // viewport when a select receives focus.
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

    const isScrollLockTarget = (target: Node) => {
      if (target === body) return true;
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          ".ant-select-dropdown, .ant-modal-wrap, .ant-drawer-content-wrapper",
        ),
      );
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
      setSelectTouchLock(false);
      setScrollLock(false);
    };
  }, []);

  const loadProduct = async () => {
    setUpdating(true);
    try {
      const product = parseProductUrl(productUrl);
      const [payload, relicSuitConfig] = await Promise.all([
        getApi<unknown>("/cbg/get_equip_detail", {
          params: {
            serverid: product.serverid,
            ordersn: product.ordersn,
          },
        }),
        loadRelicSuits<RelicSuitConfig>(),
      ]);

      const next = convertCbgPayloadToDataset(payload, relicSuitConfig);
      const loadedDataset: RelicDataset = {
        ...next,
        account: { ...next.account, sourceUrl: product.sourceUrl },
      };

      setDataset(loadedDataset);
      setProductUrl("");
      void saveRecentDatasetSnapshot(loadedDataset, product.sourceUrl)
        .then(() => refreshHistory())
        .catch(() => undefined);
      api.success("商品数据已读取并保存到本机浏览器");
    } catch (error) {
      api.error(error instanceof Error ? error.message : "商品数据读取失败");
    } finally {
      setUpdating(false);
    }
  };

  const restoreHistory = async (id: string) => {
    setUpdating(true);
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
      setDataset(restoredDataset);
      setProductUrl("");
      await saveRecentDatasetSnapshot(restoredDataset, record.productUrl);
      await refreshHistory();
      setRestoreNotice("已恢复历史记录数据");
    } catch (error) {
      api.error(error instanceof Error ? error.message : "历史记录恢复失败");
    } finally {
      setUpdating(false);
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
    setHistory(nextHistory);

    if (!deletingCurrentRecord) return;

    const nextRecord =
      nextHistory[deletedIndex] || nextHistory[deletedIndex - 1] || null;
    if (nextRecord) {
      setDataset(nextRecord.dataset);
      setProductUrl(nextRecord.productUrl);
      await saveRecentDatasetSnapshotOnly(
        nextRecord.dataset,
        nextRecord.productUrl,
      );
      setRestoreNotice("当前账号已删除，已切换到下一个账号。");
      return;
    }

    setDataset(emptyDataset);
    setProductUrl("");
    await clearRecentDatasetSnapshot();
    setRestoreNotice("当前账号已删除，已清空本地账号数据。");
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#a4342f",
          borderRadius: 3,
          colorBgLayout: "#f3f2ee",
        },
      }}
    >
      {holder}
      <Layout
        className={hasLoadedProduct ? "shell has-product" : "shell no-product"}
      >
        <Layout.Content>
          {cacheReady && (
            <>
              {hasLoadedProduct && (
                <div className="width page-menu-wrap">
                  <nav className="page-menu" aria-label="页面切换">
                    <div
                      className="page-menu-mobile-current"
                      aria-live="polite"
                    >
                      {currentNavigation.icon}
                      <span>{currentNavigation.label}</span>
                    </div>
                    <div className="page-menu-desktop-items">
                      {navigationItems.map((item) => (
                        <button
                          key={item.route}
                          className={
                            guardedPage === item.route ? "is-active" : ""
                          }
                          type="button"
                          aria-current={
                            guardedPage === item.route ? "page" : undefined
                          }
                          onClick={() => navigate(item.route)}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      className="page-menu-history"
                      type="button"
                      aria-label="History"
                      title="History"
                      disabled={updating || history.length === 0}
                      onClick={() => setHistoryOpen(true)}
                    >
                      <HistoryOutlined />
                    </button>
                    <button
                      className="page-menu-mobile-trigger"
                      type="button"
                      aria-label="打开功能菜单"
                      title="功能菜单"
                      aria-expanded={mobileMenuOpen}
                      onClick={() => setMobileMenuOpen(true)}
                    >
                      <MenuOutlined />
                      <span>菜单</span>
                    </button>
                  </nav>
                </div>
              )}
              <div className="page-route-transition" key={guardedPage}>
                {guardedPage === "overview" ? (
                  <>
                    <div className="width overview-loader-wrap">
                      <ProductLoader
                        value={productUrl}
                        loading={updating}
                        history={history}
                        showHistoryTrigger={!hasLoadedProduct}
                        restoreNotice={restoreNotice}
                        onChange={setProductUrl}
                        onLoad={loadProduct}
                        onOpenHistory={() => setHistoryOpen(true)}
                      />
                    </div>
                    {hasLoadedProduct && (
                      <OverviewPage
                        dataset={dataset}
                        onOpenRelics={() => navigate("relics")}
                        onNavigate={(route) => navigate(route)}
                      />
                    )}
                  </>
                ) : guardedPage === "relics" ? (
                  <RelicsPage dataset={dataset} />
                ) : guardedPage === "speed" ? (
                  <SpeedPage
                    dataset={dataset}
                    onOpenCalculator={() => navigate("calculator")}
                  />
                ) : guardedPage === "pve" ? (
                  <PvePage dataset={dataset} />
                ) : guardedPage === "hero-skills" ? (
                  <HeroSkillsPage dataset={dataset} />
                ) : (
                  <CalculatorWorkspace
                    dataset={dataset}
                    staticRefreshRequestId={calculatorStaticRefreshRequestId}
                  />
                )}
              </div>
            </>
          )}
          <DatasetHistoryModal
            open={historyOpen}
            history={history}
            onOpenChange={setHistoryOpen}
            onRestore={(id) => void restoreHistory(id)}
            onDelete={(id) => void deleteHistory(id)}
          />
          <Drawer
            className="mobile-navigation-drawer"
            placement="right"
            title="功能菜单"
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          >
            <nav className="mobile-navigation-list" aria-label="功能菜单">
              <section
                className="mobile-navigation-pages"
                aria-label="页面导航"
              >
                {navigationItems.map((item) => (
                  <button
                    key={item.route}
                    className={guardedPage === item.route ? "is-active" : ""}
                    type="button"
                    aria-current={
                      guardedPage === item.route ? "page" : undefined
                    }
                    onClick={() => navigateFromMenu(item.route)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </section>
              <section
                className="mobile-navigation-actions"
                aria-label="数据操作"
              >
                <button
                  type="button"
                  disabled={updating || history.length === 0}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setHistoryOpen(true);
                  }}
                >
                  <HistoryOutlined />
                  <span>历史记录</span>
                </button>
                <div className="static-refresh-menu-item">
                  <button
                    type="button"
                    disabled={staticDataLoading}
                    onClick={() => {
                      void refreshStaticDataFromMenu();
                    }}
                  >
                    <ReloadOutlined />
                    <span>更新静态资料</span>
                  </button>
                  <small>
                    同步式神面板与御魂套装资料，不会更新当前账号数据
                  </small>
                </div>
              </section>
            </nav>
          </Drawer>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
