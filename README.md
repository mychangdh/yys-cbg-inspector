# 阴阳师藏宝阁看号工具

项目由两个完全独立的 Node 项目组成：

```text
yys-cbg-inspector-frontend/  React + TypeScript + Ant Design + Vite
yys-cbg-inspector-backend/   Node.js + TypeScript API
yys-cbg-inspector-database/  MySQL 数据库结构与静态数据快照
```

根目录不包含 Node 项目、依赖或启动脚本。请分别进入两个目录安装依赖和启动服务。

## 前端

```powershell
cd yys-cbg-inspector-frontend
npm install
npm run dev
```

开发地址为 `http://127.0.0.1:12831`。Vite 将前端接口请求代理至后端服务。

构建静态站点：

```powershell
cd yys-cbg-inspector-frontend
npm run build
```

构建产物位于 `yys-cbg-inspector-frontend/dist/`。

## 后端

```powershell
cd yys-cbg-inspector-backend
npm install
npm run dev
```

后端默认监听 `http://127.0.0.1:3001`，提供静态游戏数据和藏宝阁详情代理接口。

生产启动：

```powershell
cd yys-cbg-inspector-backend
npm start
```

## 数据库初始化

后端静态数据从 MySQL 读取。首次部署时，先安装 MySQL 5.7，并按顺序导入数据库目录中的 SQL 文件：

```powershell
cd yys-cbg-inspector-database
cmd /c "mysql --default-character-set=utf8mb4 -u root -p < yys_cbg_inspector.sql"
```

该 SQL 快照会创建 `yys_cbg_inspector` 数据库及静态数据表，包括：

- `heroes`：式神 ID、名称、稀有度与基础面板。
- `relic_suits`：御魂套装信息、两件套属性和逢魔标识。
- `collection_skins`：典藏皮肤 ID 与名称。

数据库快照只包含静态游戏资料，不包含游戏账号密码、藏宝阁登录态、商品御魂库存或任何用户本地计算记录。
数据库目录中的 `mysql-installer-web-community-5.7.44.0.msi` 是 MySQL 官方 Web 安装器；运行它后选择安装 MySQL Server 5.7.44。该安装器会在安装期间联网下载组件。

## 后端环境变量

在 `yys-cbg-inspector-backend` 目录创建 `.env`，以 `.env.example` 为模板填写实际连接信息：

```env
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://127.0.0.1:12831

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=yys_cbg_app
MYSQL_PASSWORD=填写实际数据库密码
MYSQL_DATABASE=yys_cbg_inspector
```

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3001` | 后端 HTTP 服务端口 |
| `HOST` | `0.0.0.0` | 后端监听地址；只在本机使用时可设为 `127.0.0.1` |
| `CORS_ORIGIN` | `*` | 允许访问后端的前端来源；部署时应指定具体地址 |
| `MYSQL_HOST` | `127.0.0.1` | MySQL 主机地址 |
| `MYSQL_PORT` | `3306` | MySQL 端口 |
| `MYSQL_USER` | `root` | MySQL 用户名 |
| `MYSQL_PASSWORD` | 空 | MySQL 密码 |
| `MYSQL_DATABASE` | `yys_cbg_inspector` | 使用的数据库名 |

启动后端后，可访问 `http://127.0.0.1:3001/health` 检查连接状态。接口返回 `database: "connected"` 表示 MySQL 可用；如果返回失败，请依次确认 MySQL 服务、主机、端口、账号权限、密码和数据库名。

## 密码与敏感信息

本项目不收集阴阳师账号密码、藏宝阁登录密码或支付密码。藏宝阁详情接口只使用商品链接解析出的公开参数。

- `MYSQL_PASSWORD` 只能写入后端本机的 `.env`、系统环境变量或部署平台的密钥管理服务。
- 不要把真实密码写进 `.env.example`、`README.md`、前端 `.env.*`、源码、SQL 文件、日志或截图。
- Vite 以 `VITE_` 开头的变量会被打包到浏览器端，绝不能存放数据库密码、令牌或私钥。
- 生产环境应使用权限受限的专用 MySQL 账号，不要让应用长期使用 `root`；数据库端口 `3306` 不应直接暴露到公网。
- `.env` 已被 Git 忽略。提交前用 `git status --short` 和 `git diff --check` 检查，确认没有密码或密钥进入版本控制。
