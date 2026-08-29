import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  protocol,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import { spawn } from "node:child_process";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "yys-cbg-assets",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let nativeCalculatorProcess: ReturnType<typeof spawn> | null = null;
type NativeCalculatorSession = {
  process: ReturnType<typeof spawn>;
  activeRequest: {
    output: string;
    timeout: NodeJS.Timeout;
    resolve: (results: NativeCalculatorResult[]) => void;
    reject: (error: Error) => void;
  } | null;
  stdoutRemainder: string;
  stderrRemainder: string;
};

let nativeCalculatorSession: NativeCalculatorSession | null = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

type ProductRequest = {
  serverid?: unknown;
  ordersn?: unknown;
};

const staticDataFiles = {
  "/static/heroes": "heroes.json",
  "/static/relic-suits": "relic-suits.json",
} as const;

const remoteApiBaseUrl = "http://39.96.207.211:12377/yys-cbg-inspector";

type StaticDataEndpoint = keyof typeof staticDataFiles;

type StaticAssetKind = "heroes" | "suits";

type StaticAssetUpdateRequest = {
  heroIds?: unknown;
  suitIds?: unknown;
};

type StaticAssetUpdateResult = {
  heroIcons: number;
  suitIcons: number;
  failed: number;
};

type NativeCalculatorResult = {
  score: number;
  relicIndexes: number[];
  panel: {
    attack: number;
    health: number;
    defense: number;
    speed: number;
    critRate: number;
    critDamage: number;
    effectHit: number;
    effectResistance: number;
    attackPercent: number;
    healthPercent: number;
    defensePercent: number;
    flatAttack: number;
    flatHealth: number;
    flatDefense: number;
  };
};

function getNativeCalculatorPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "native", "relic-calculator.exe")
    : path.join(app.getAppPath(), "build", "native", "relic-calculator.exe");
}

function parseNativeCalculatorOutput(output: string): NativeCalculatorResult[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts[0] !== "RESULT" || parts.length !== 22) return [];
    const values = parts.slice(1).map(Number);
    if (values.some((value) => !Number.isFinite(value))) return [];
    const [score, ...rest] = values;
    const relicIndexes = rest.slice(0, 6);
    const panelValues = rest.slice(6);
    return [
      {
        score,
        relicIndexes,
        panel: {
          attack: panelValues[0],
          health: panelValues[1],
          defense: panelValues[2],
          speed: panelValues[3],
          critRate: panelValues[4],
          critDamage: panelValues[5],
          effectHit: panelValues[6],
          effectResistance: panelValues[7],
          attackPercent: panelValues[8],
          healthPercent: panelValues[9],
          defensePercent: panelValues[10],
          flatAttack: panelValues[11],
          flatHealth: panelValues[12],
          flatDefense: panelValues[13],
        },
      },
    ];
  });
}

function disposeNativeCalculatorSession(): void {
  const session = nativeCalculatorSession;
  nativeCalculatorSession = null;
  nativeCalculatorProcess = null;
  if (!session) return;

  const activeRequest = session.activeRequest;
  session.activeRequest = null;
  if (activeRequest) {
    clearTimeout(activeRequest.timeout);
    activeRequest.reject(new Error("原生计算已终止"));
  }
  if (!session.process.killed) session.process.kill();
}

function createNativeCalculatorSession(): NativeCalculatorSession {
  const process = spawn(getNativeCalculatorPath(), ["--serve"], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const session: NativeCalculatorSession = {
    process,
    activeRequest: null,
    stdoutRemainder: "",
    stderrRemainder: "",
  };
  nativeCalculatorSession = session;
  nativeCalculatorProcess = process;

  process.stdout.on("data", (chunk: Buffer) => {
    session.stdoutRemainder += chunk.toString("utf8");
    const lines = session.stdoutRemainder.split(/\r?\n/);
    session.stdoutRemainder = lines.pop() || "";
    for (const line of lines) {
      const request = session.activeRequest;
      if (!request) continue;
      if (line.trim() === "DONE") {
        session.activeRequest = null;
        clearTimeout(request.timeout);
        request.resolve(parseNativeCalculatorOutput(request.output));
        continue;
      }
      if (line.startsWith("ERROR ")) {
        session.activeRequest = null;
        clearTimeout(request.timeout);
        request.reject(new Error("原生计算执行失败"));
        continue;
      }
      request.output += `${line}\n`;
    }
  });
  process.stderr.on("data", (chunk: Buffer) => {
    session.stderrRemainder += chunk.toString("utf8");
    const lines = session.stderrRemainder.split(/\r?\n/);
    session.stderrRemainder = lines.pop() || "";
    for (const line of lines) {
      const request = session.activeRequest;
      if (!request || !line.trim().startsWith("PROGRESS")) continue;
      const parts = line.trim().split(/\s+/);
      // 新协议为 `PROGRESS <阶段> <已处理> <总数>`。保留旧三段式的
      // 兼容读取，避免开发时旧的原生程序仍在运行导致界面丢失进度。
      const hasStage = parts.length >= 4;
      const stage = hasStage ? parts[1] : "search";
      const processed = Number(parts[hasStage ? 2 : 1]);
      const total = Number(parts[hasStage ? 3 : 2]);
      if (
        mainWindow &&
        Number.isFinite(processed) &&
        Number.isFinite(total) &&
        total > 0
      ) {
        mainWindow.webContents.send("calculator:native-progress", {
          stage,
          processed,
          total,
        });
      }
    }
  });
  process.once("error", () => disposeNativeCalculatorSession());
  process.once("close", () => disposeNativeCalculatorSession());
  return session;
}

function runNativeCalculatorInSession(
  protocolBuffer: Buffer,
): Promise<NativeCalculatorResult[]> {
  if (protocolBuffer.byteLength > 32 * 1024 * 1024) {
    return Promise.reject(new Error("计算数据过大，无法交给原生计算器"));
  }
  return new Promise((resolve, reject) => {
    const session = nativeCalculatorSession || createNativeCalculatorSession();
    if (session.activeRequest) {
      reject(new Error("已有原生计算任务正在执行"));
      return;
    }
    if (!session.process.stdin) {
      disposeNativeCalculatorSession();
      reject(new Error("原生计算器输入通道不可用"));
      return;
    }
    const timeout = setTimeout(disposeNativeCalculatorSession, 120_000);
    session.activeRequest = { output: "", timeout, resolve, reject };

    // 一次写入完整长度帧：不拆分候选、筛选条件或套装数据，也不重复启动 C++。
    session.process.stdin.cork();
    session.process.stdin.write(`REQUEST ${protocolBuffer.byteLength}\n`, "utf8");
    session.process.stdin.write(protocolBuffer);
    session.process.stdin.uncork();
  });
}

function runNativeCalculatorLegacy(
  protocolText: string,
): Promise<NativeCalculatorResult[]> {
  if (protocolText.length > 8 * 1024 * 1024) {
    return Promise.reject(new Error("计算数据过大，已改用本地兼容计算"));
  }
  return new Promise((resolve, reject) => {
    const process = spawn(getNativeCalculatorPath(), ["--compute"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    nativeCalculatorProcess = process;
    let stdout = "";
    let stderr = "";
    let stderrProgressRemainder = "";
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      callback();
    };
    timeout = setTimeout(() => {
      if (!process.killed) process.kill();
      finish(() => reject(new Error("原生计算核心超时")));
    }, 120_000);
    process.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    process.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      stderrProgressRemainder += text;
      const lines = stderrProgressRemainder.split(/\r?\n/);
      stderrProgressRemainder = lines.pop() || "";
      lines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] !== "PROGRESS" || parts.length < 3 || !mainWindow) return;
        const processed = Number(parts[1]);
        const total = Number(parts[2]);
        if (Number.isFinite(processed) && Number.isFinite(total) && total > 0) {
          mainWindow.webContents.send("calculator:native-progress", {
            processed,
            total,
          });
        }
      });
    });
    process.once("error", () =>
      finish(() => reject(new Error("Native calculator could not start"))),
    );
    process.once("close", (code) => {
      if (nativeCalculatorProcess === process) nativeCalculatorProcess = null;
      if (code !== 0) {
        const errorText = stderr
          .split(/\r?\n/)
          .filter((line) => !line.trim().startsWith("PROGRESS"))
          .join("\n")
          .trim();
        finish(() => reject(new Error(errorText || "Native calculator failed")));
        return;
      }
      finish(() => resolve(parseNativeCalculatorOutput(stdout)));
    });
    process.stdin.end(protocolText, "utf8");
  });
}

function runNativeCalculator(
  protocolBuffer: Buffer,
): Promise<NativeCalculatorResult[]> {
  return runNativeCalculatorInSession(protocolBuffer);
}

function protocolBufferFrom(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);

  // contextBridge 会跨 V8 上下文克隆 TypedArray，不能依赖 instanceof。
  // 只读取字节视图公开的缓冲区、偏移和长度，避免把大协议重新编码或逐项展开。
  if (!value || typeof value !== "object") return null;
  const bytes = value as {
    buffer?: unknown;
    byteOffset?: unknown;
    byteLength?: unknown;
  };
  if (
    bytes.buffer instanceof ArrayBuffer &&
    typeof bytes.byteOffset === "number" &&
    typeof bytes.byteLength === "number"
  ) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return null;
}

function cancelNativeCalculator(): void {
  disposeNativeCalculatorSession();
}

function isStaticDataEndpoint(value: unknown): value is StaticDataEndpoint {
  return typeof value === "string" && value in staticDataFiles;
}

function getStaticDataPath(endpoint: StaticDataEndpoint): string {
  return path.join(
    app.getPath("userData"),
    "static-data",
    staticDataFiles[endpoint],
  );
}

function getStaticAssetPath(kind: StaticAssetKind, id: number): string {
  return path.join(
    app.getPath("userData"),
    "static-data",
    "assets",
    kind,
    `${id}.png`,
  );
}

function getBundledStaticAssetPath(kind: StaticAssetKind, id: number): string {
  const assetDirectory = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "static-data", "assets")
    : path.join(app.getAppPath(), "public", "static-data", "assets");
  return path.join(assetDirectory, kind, `${id}.png`);
}

function getBundledUiAssetPath(name: string): string {
  const assetDirectory = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "static-data", "assets", "ui")
    : path.join(app.getAppPath(), "public", "static-data", "assets", "ui");
  return path.join(assetDirectory, name);
}

function getApplicationIconPath(): string {
  const assetPath = app.isPackaged
    ? path.join(
        app.getAppPath(),
        "dist",
        "static-data",
        "assets",
        "hao-lai-icon.ico",
      )
    : path.join(
        app.getAppPath(),
        "public",
        "static-data",
        "assets",
        "hao-lai-icon.ico",
      );
  return assetPath;
}

function getOfficialAssetUrl(kind: StaticAssetKind, id: number): string {
  if (kind === "heroes") {
    return `https://cbg-yys.res.netease.com/game_res/hero/${id}/${id}.png`;
  }
  return `https://cbg-yys.res.netease.com/game_res/suit/${id}.png`;
}

function isAssetId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

async function downloadStaticAsset(
  kind: StaticAssetKind,
  id: number,
): Promise<Uint8Array> {
  const response = await fetch(getOfficialAssetUrl(kind, id));
  if (!response.ok) throw new Error(`图标请求失败：${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("图标内容为空");
  if (!isPng(bytes)) throw new Error("图标内容不是有效 PNG");

  const filePath = getStaticAssetPath(kind, id);
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  return bytes;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

async function readValidPng(filePath: string): Promise<Uint8Array | null> {
  try {
    const bytes = await readFile(filePath);
    return isPng(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

async function readStaticAsset(
  kind: StaticAssetKind,
  id: number,
): Promise<Uint8Array | null> {
  return (
    (await readValidPng(getStaticAssetPath(kind, id))) ||
    (await readValidPng(getBundledStaticAssetPath(kind, id)))
  );
}

function toUniqueAssetIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isAssetId))].slice(0, 1_000);
}

async function updateStaticAssetGroup(
  kind: StaticAssetKind,
  ids: number[],
): Promise<{ updated: number; failed: number }> {
  const concurrency = 6;
  let cursor = 0;
  let updated = 0;
  let failed = 0;

  const worker = async (): Promise<void> => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await downloadStaticAsset(kind, id);
        updated += 1;
      } catch {
        failed += 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
  );
  return { updated, failed };
}

/** 自定义协议只读取用户目录或安装包内的本地图标，正常浏览页面不会请求网络。 */
function registerStaticAssetProtocol(): void {
  protocol.handle("yys-cbg-assets", async (request) => {
    const url = new URL(request.url);
    const kind = url.hostname;
    if (kind === "ui") {
      const name = url.pathname.match(/^\/([a-z0-9-]+\.(?:png|svg))$/)?.[1];
      if (!name) return new Response(null, { status: 404 });
      try {
        const bytes = await readFile(getBundledUiAssetPath(name));
        return new Response(Uint8Array.from(bytes), {
          headers: {
            "content-type": name.endsWith(".svg")
              ? "image/svg+xml"
              : "image/png",
            "cache-control": "public, max-age=31536000",
          },
        });
      } catch {
        return new Response(null, { status: 404 });
      }
    }
    const idText = url.pathname.match(/^\/(\d+)\.png$/)?.[1];
    if ((kind !== "heroes" && kind !== "suits") || !idText) {
      return new Response(null, { status: 404 });
    }

    const bytes = await readStaticAsset(kind, Number(idText));
    if (!bytes) return new Response(null, { status: 404 });

    // 从文件读取的 Buffer 可能使用 SharedArrayBuffer；Response 只接受普通 ArrayBuffer 视图。
    return new Response(Uint8Array.from(bytes), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000",
      },
    });
  });
}

/** Electron 直接请求藏宝阁商品详情，不依赖本地或远程代理服务。 */
function registerProductRequestHandler(): void {
  ipcMain.handle("app:get-version", (): string => app.getVersion());

  ipcMain.handle("system:compute-capacity", () => {
    const memory = process.getSystemMemoryInfo();
    return {
      logicalCores: Math.max(1, os.cpus().length),
      totalMemoryMb: Math.floor(memory.total / 1024),
      freeMemoryMb: Math.floor(memory.free / 1024),
    };
  });
  ipcMain.handle(
    "product:load",
    async (_event, request: ProductRequest): Promise<unknown> => {
      const serverid = String(request.serverid || "");
      const ordersn = String(request.ordersn || "");
      if (!/^\d+$/.test(serverid) || !ordersn) {
        throw new Error("商品链接参数无效");
      }

      const target = new URL(
        "https://yys.cbg.163.com/cgi/api/get_equip_detail",
      );
      target.searchParams.set("serverid", serverid);
      target.searchParams.set("ordersn", ordersn);

      let response: Response;
      try {
        response = await fetch(target, {
          headers: {
            "user-agent": "YYS-CBG-Inspector/1.0",
            referer: "https://yys.cbg.163.com/",
          },
        });
      } catch {
        throw new Error("商品数据暂时无法获取，请稍后重试");
      }

      if (!response.ok) {
        throw new Error("商品数据暂时无法获取，请稍后重试");
      }

      try {
        return await response.json();
      } catch {
        throw new Error("商品数据格式异常，请稍后重试");
      }
    },
  );
  ipcMain.handle("calculator:cancel-native", (): void => {
    cancelNativeCalculator();
  });
}

/** Windows 桌面端固定窗口，页面不再承担移动端断点布局。 */
/** 静态数据由 Electron 保存在用户数据目录，日常使用只读本地文件。 */
function registerStaticDataRequestHandler(): void {
  ipcMain.handle("downloads:open", async (): Promise<void> => {
    await shell.openPath(app.getPath("downloads"));
  });

  ipcMain.handle(
    "calculator:compute-native",
    async (
      _event,
      protocolBytes: unknown,
    ): Promise<NativeCalculatorResult[]> => {
      const protocolBuffer = protocolBufferFrom(protocolBytes);
      if (!protocolBuffer) throw new Error("原生计算参数无效");
      return runNativeCalculator(protocolBuffer);
    },
  );

  ipcMain.handle(
    "static-data:read",
    async (_event, endpoint: unknown): Promise<unknown> => {
      if (!isStaticDataEndpoint(endpoint)) {
        throw new Error("数据类型无效");
      }

      try {
        return JSON.parse(await readFile(getStaticDataPath(endpoint), "utf8"));
      } catch {
        // 首次启动由渲染端回退到 src/data 内置数据；维护后才读取用户目录中的新版本。
        return null;
      }
    },
  );

  ipcMain.handle(
    "static-data:update",
    async (_event, endpoint: unknown): Promise<unknown> => {
      if (!isStaticDataEndpoint(endpoint)) {
        throw new Error("数据类型无效");
      }

      let response: Response;
      try {
        response = await fetch(`${remoteApiBaseUrl}${endpoint}`);
      } catch {
        throw new Error("远程数据暂时无法获取，请稍后重试");
      }

      if (!response.ok) {
        throw new Error("远程数据暂时无法获取，请稍后重试");
      }

      try {
        const data: unknown = await response.json();
        const filePath = getStaticDataPath(endpoint);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(data), "utf8");
        return data;
      } catch {
        throw new Error("远程数据保存失败，请稍后重试");
      }
    },
  );

  ipcMain.handle(
    "static-assets:update",
    async (
      _event,
      request: StaticAssetUpdateRequest,
    ): Promise<StaticAssetUpdateResult> => {
      const heroIds = toUniqueAssetIds(request?.heroIds);
      const suitIds = toUniqueAssetIds(request?.suitIds);
      const [heroes, suits] = await Promise.all([
        updateStaticAssetGroup("heroes", heroIds),
        updateStaticAssetGroup("suits", suitIds),
      ]);
      return {
        heroIcons: heroes.updated,
        suitIcons: suits.updated,
        failed: heroes.failed + suits.failed,
      };
    },
  );

  ipcMain.handle(
    "static-data:save",
    async (_event, endpoint: unknown, data: unknown): Promise<unknown> => {
      if (!isStaticDataEndpoint(endpoint)) throw new Error("数据类型无效");
      if (data === null || typeof data !== "object") {
        throw new Error("JSON 根节点必须是对象或数组");
      }
      const filePath = getStaticDataPath(endpoint);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
      return data;
    },
  );
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 1180,
    minHeight: 760,
    maxWidth: 1180,
    maxHeight: 760,
    resizable: false,
    icon: getApplicationIconPath(),
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.setIcon(getApplicationIconPath());

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    void mainWindow.loadURL(developmentUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "应用",
      submenu: [
        { role: "reload", label: "重新加载页面" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "数据维护",
      submenu: [
        {
          label: "更新式神与御魂数据",
          click: () => mainWindow?.webContents.send("maintenance:open"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      createMainWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.yys.cbg.inspector");
    registerStaticAssetProtocol();
    registerProductRequestHandler();
    registerStaticDataRequestHandler();
    Menu.setApplicationMenu(null);
    createMainWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    cancelNativeCalculator();
  });
}
