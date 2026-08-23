import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke("app:get-version");
  },
  getComputeCapacity(): Promise<{
    logicalCores: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
  }> {
    return ipcRenderer.invoke("system:compute-capacity");
  },
  loadProduct(request: {
    serverid: string;
    ordersn: string;
  }): Promise<unknown> {
    return ipcRenderer.invoke("product:load", request);
  },
  readStaticData(endpoint: string): Promise<unknown> {
    return ipcRenderer.invoke("static-data:read", endpoint);
  },
  updateStaticData(endpoint: string): Promise<unknown> {
    return ipcRenderer.invoke("static-data:update", endpoint);
  },
  saveStaticData(endpoint: string, data: unknown): Promise<unknown> {
    return ipcRenderer.invoke("static-data:save", endpoint, data);
  },
  updateStaticAssets(request: {
    heroIds: number[];
    suitIds: number[];
  }): Promise<{
    heroIcons: number;
    suitIcons: number;
    failed: number;
  }> {
    return ipcRenderer.invoke("static-assets:update", request);
  },
  openDownloadsFolder(): Promise<void> {
    return ipcRenderer.invoke("downloads:open");
  },
  onOpenMaintenance(listener: () => void): () => void {
    const channel = "maintenance:open";
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
