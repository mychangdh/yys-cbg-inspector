# 号来 · Tauri 桌面版

这是阴阳师藏宝阁数据分析工具的 Tauri 2 + React + TypeScript 桌面版。页面和计算器逻辑沿用 Electron 版，桌面能力集中在 `src-tauri/src/lib.rs`，方便后续继续替换和维护。

## 开发环境

- Node.js 与 Yarn
- Rust stable MSVC 工具链
- Windows C++ 构建工具（Windows 桌面打包需要）

## 常用命令

```powershell
yarn                 # 安装前端依赖
yarn test            # TypeScript 类型检查
yarn dev             # 仅启动 Vite 页面调试
yarn tauri dev       # 启动 Tauri 桌面调试
yarn release:version 1.0.0-beta-4 # 同步三个项目版本号
yarn package         # 同时生成 NSIS 安装包和免安装程序目录
yarn package:installer # 只生成 NSIS 安装包
yarn package:portable  # 只生成免安装程序目录
```

首次启动 Tauri 时 Cargo 还可能下载并编译 Rust 依赖，这是正常现象。

## 发布产物

`yarn package` 会把产物统一整理到 `release/tauri/`：

```text
release/tauri/
├─ installer/
│  └─ 号来-版本号.exe     # NSIS 安装包
└─ portable/
   └─ 号来-版本号/        # 免安装目录，复制后可直接运行
      ├─ 号来.exe
      └─ static-data/assets/
```

产物名称中的“版本号”读取自 `src-tauri/tauri.conf.json`。安装包外层文件名和免安装目录会带版本号，免安装目录内的程序文件固定命名为 `号来.exe`。以后使用 `yarn release:version <版本号>` 即可同步 `package.json`、Tauri 配置和 Cargo 配置。

项目只生成 NSIS，不生成 MSI，因此不会触发 WiX 工具链。免安装目录必须连同 `static-data` 一起分发；其中包含式神、御魂和界面图标等外部静态资源。

## 运行时约定

- `src/lib/tauriDesktop.ts` 负责把页面使用的 `window.desktop` 映射到 Tauri command。
- 式神、御魂资料和更新后的图标写入 Tauri 应用数据目录，不修改安装包内文件。
- `yys-cbg-assets` 是只读本地资源协议，优先读取用户数据目录，再读取安装包资源；Windows WebView2 会以 `http://yys-cbg-assets.localhost/...` 形式访问它。
- Tauri 窗口不注册原生菜单栏；开发模式会自动打开 DevTools，生产包不主动打开。
- 远程商品和静态资料更新请求由 Rust 侧发起，避免浏览器跨域限制。

## 代码规范

组件、页面、样式和类型文件按同目录归属；公共样式放在 `src/styles/`，公共类型放在 `src/types/`。注释使用中文，提交前至少执行 `yarn test` 和 Rustfmt 检查。

推荐使用 VS Code，并安装 Tauri、rust-analyzer 扩展。
