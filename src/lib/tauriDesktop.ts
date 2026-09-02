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

function logDevIpc(command: string, payload?: unknown): void {
  if (import.meta.env.DEV) {
    console.info(`[Tauri IPC] ${command}`, payload ?? "");
  }
}

/** 将页面需要的桌面能力集中映射到 Tauri command。 */
export function installTauriDesktopBridge(): void {
  if (window.desktop) return;

  if (!isTauriRuntime) {
    window.desktop = {
      getAppVersion: async () => "0.1.0",
      getComputeCapacity: async () => browserCapacity(),
      loadProduct: (request) =>
        unsupportedInBrowser(`读取藏宝阁商品（${request.ordersn}）`),
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
    loadProduct: (request) => {
      logDevIpc("load_product", request);
      return invoke<unknown>("load_product", { request });
    },
    readStaticData: (endpoint) => invoke<unknown>("read_static_data", { endpoint }),
    updateStaticData: (endpoint) => {
      logDevIpc("update_static_data", endpoint);
      return invoke<unknown>("update_static_data", { endpoint });
    },
    saveStaticData: (endpoint, data) =>
      invoke<unknown>("save_static_data", { endpoint, data }),
    updateStaticAssets: (request) => {
      logDevIpc("update_static_assets", {
        heroCount: request.heroIds.length,
        suitCount: request.suitIds.length,
      });
      return invoke<StaticAssetUpdateResult>("update_static_assets", { request });
    },
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
