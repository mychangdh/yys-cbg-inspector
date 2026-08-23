# 阴阳师藏宝阁看号工具

这是 Windows Electron 桌面端项目。项目直接使用远程数据服务，不再包含本地后端或数据库工程。

## 开发

```powershell
npm install
npm run electron:dev
```

开发启动时会先使用本机 Visual Studio C++ 工具链编译御魂计算核心。原生核心位于 `electron/native/`，计算器会优先调用它；不满足原生搜索条件时自动回退到 Worker。

单独验证原生计算链路：

```powershell
npm run test:native-calculator
```

开发窗口默认 1180 x 760，可按屏幕大小调整，最小为 960 x 640。页面中的账号数据保存在本机；式神面板和御魂套装数据只会在应用内“数据维护”入口主动更新。

## 打包

```powershell
npm run electron:dist
```

Windows 安装包会生成在 `release/` 目录。若本机证书链由系统管理，打包脚本会自动使用 Windows 系统证书。

## 远程数据更新

在 Electron 菜单中打开“数据维护”并执行“更新式神与御魂数据”。更新成功后会记录本机时间，30 分钟内不能再次请求远程数据，避免重复调用服务器。
