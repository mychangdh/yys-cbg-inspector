# 号来

## 项目已迁移

本项目已迁移至 `tauri` 分支，Electron 分支已停止维护。请切换到 `tauri` 分支获取最新代码。

号来是一个面向《阴阳师》藏宝阁账号查看与御魂分析的 Windows 桌面应用。它将账号资料、式神、御魂库存、PVE 高评分御魂和御魂组合计算集中在一个本地优先的工具中，便于查看账号练度与配装上限。

## 功能

- 直接解析阴阳师藏宝阁账号链接，展示账号概览、资源、式神与御魂数据。
- 按号位、套装、主属性和副属性筛选御魂，并查看强化详情。
- 在本机计算御魂组合，支持套装、主属性、最终面板范围、额外属性和快捷配置。
- 展示 PVE 常用输出御魂及逢魔御魂的有效词条评分。
- 按稀有度查看 UR、SP、SSR 式神技能等级。
- 在应用内维护式神、御魂静态资料，支持 JSON 与 Excel 导入、导出及远程更新。

## 数据与隐私

- 日常使用优先读取本地保存的账号缓存、静态资料和图标资源。
- 商品详情由 Electron 客户端直接请求藏宝阁，不经过本项目的中间业务服务。
- 御魂组合计算在本机执行。
- 只有在“数据维护”中主动更新静态资料时，应用才会请求配置的远程静态数据服务。

## 技术栈

- Electron 43
- React 19 + TypeScript
- Vite 7
- Ant Design 5
- Sass
- SheetJS (`xlsx`)，用于 Excel 导入与导出

## 开发环境

建议使用 Node.js 20 LTS 或更高版本，并在 Windows 上执行以下命令：

```powershell
npm install
npm run electron:dev
```

开发模式会启动 Vite 开发服务器和 Electron 主进程。桌面端开发服务器固定使用 `http://127.0.0.1:12832`，避免与浏览器端项目端口冲突。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run electron:dev` | 启动 Electron 开发环境 |
| `npm run build` | 校验静态资源、类型检查并构建渲染进程 |
| `npm run electron:compile` | 编译 Electron 主进程和预加载脚本 |
| `npm run test` | 执行 TypeScript 类型检查 |
| `npm run test:calculator` | 校验御魂计算相关逻辑 |
| `npm run benchmark:real-account` | 运行真实账号数据基准测试 |
| `npm run electron:dist` | 构建 Windows NSIS 安装包 |

## 打包

```powershell
npm run electron:dist
```

打包产物位于 `release/`：

- `号来 Setup <版本号>.exe`：Windows 安装包。
- `号来 Setup <版本号>.exe.blockmap`：差分更新元数据。

版本号由 `package.json` 中的 `version` 字段控制。Windows 应用图标使用 `public/static-data/assets/hao-lai-icon.ico`，应用名为“号来”。

安装包不应提交到 Git 历史。发布新版本时，请将 `release/` 中的 `.exe` 作为 GitHub 或 Gitee Release 附件上传。

## 静态资料维护

在应用菜单中进入“数据维护”后，可以：

- 查看和编辑本地式神、御魂资料。
- 导入或导出 JSON、Excel 文件。
- 恢复默认配置。
- 手动请求远程静态资料并更新本地图标。

静态资料更新有时间间隔限制，避免对远程服务重复请求。

## 目录说明

```text
electron/                 Electron 主进程与预加载脚本
public/static-data/       内置图标等静态资源
scripts/                  资源校验、下载和计算基准脚本
src/                      React 渲染进程代码
src/lib/calculator/       御魂计算核心与搜索优化模块
release/                  本地打包产物，不提交到 Git
```

## 开源协议

本项目采用 [MIT License](LICENSE)。
