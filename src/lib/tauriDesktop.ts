import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type ComputeCapacity = {
  logicalCores: number;
  totalMemoryMb: number;
  freeMemoryMb: number;
};

type StaticAssetUpdateResult = {
  heroIcons: number;
  suitIcons: number;
  failed: number;
};

const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function browserCapacity(): ComputeCapacity {
  return {
    logicalCores: Math.max(1, navigator.hardwareConcurrency || 1),
    totalMemoryMb: 0,
    freeMemoryMb: 0,
  };
}

function unsupportedInBrowser(operation: string): Promise<never> {
  return Promise.reject(new Error(`${operation} 仅支持 Tauri 桌面运行时`));
}

/**
 * 将旧 Electron 页面使用的 desktop 接口映射到 Tauri command。
 * 页面层继续依赖稳定的业务接口，桌面运行时的替换集中在这一处完成。
 */
export function installTauriDesktopBridge(): void {
  if (window.desktop) return;

  if (!isTauriRuntime) {
    window.desktop = {
      getAppVersion: async () => "0.1.0",
      getComputeCapacity: async () => browserCapacity(),
      loadProduct: (request) => unsupportedInBrowser(`读取藏宝阁商品（${request.ordersn}）`),
      readStaticData: async () => null,
      updateStaticData: () => unsupportedInBrowser("更新静态资料"),
      saveStaticData: async (_endpoint, data) => data,
      updateStaticAssets: async (): Promise<StaticAssetUpdateResult> => ({
        heroIcons: 0,
        suitIcons: 0,
        failed: 0,
      }),
      openDownloadsFolder: async () => undefined,
      calculateRelicsNative: () => unsupportedInBrowser("原生计算"),
      onNativeCalculatorProgress: () => () => undefined,
      cancelNativeCalculator: async () => undefined,
      onOpenMaintenance: () => () => undefined,
    };
    return;
  }

  window.desktop = {
    getAppVersion: () => invoke<string>("get_app_version"),
    getComputeCapacity: () => invoke<ComputeCapacity>("get_compute_capacity"),
    loadProduct: (request) => invoke<unknown>("load_product", { request }),
    readStaticData: (endpoint) => invoke<unknown>("read_static_data", { endpoint }),
    updateStaticData: (endpoint) => invoke<unknown>("update_static_data", { endpoint }),
    saveStaticData: (endpoint, data) =>
      invoke<unknown>("save_static_data", { endpoint, data }),
    updateStaticAssets: (request) =>
      invoke<StaticAssetUpdateResult>("update_static_assets", { request }),
    openDownloadsFolder: () => invoke<void>("open_downloads_folder"),
    calculateRelicsNative: () => unsupportedInBrowser("原生计算"),
    onNativeCalculatorProgress: () => () => undefined,
    cancelNativeCalculator: async () => undefined,
    onOpenMaintenance(listener) {
      let disposed = false;
      let unlisten: (() => void) | undefined;

      void listen("maintenance:open", () => {
        if (!disposed) listener();
      }).then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      });

      return () => {
        disposed = true;
        unlisten?.();
      };
    },
  };
}
