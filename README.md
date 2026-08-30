# 阴阳师藏宝阁看号工具

当前分支采用单根目录结构：Next.js 负责 Web 应用，NestJS 负责 API，数据库快照和静态资源也由根目录统一管理。

```text
app/                 Next.js App Router 路由入口
src/                 页面、组件、状态、算法与样式
server/              NestJS 模块、控制器、服务和数据库访问
public/assets/       Next.js 与 NestJS 共用的静态资源
database/            MySQL 结构与静态数据快照
```

## 开发

在项目根目录安装依赖：

```powershell
npm install
```

启动 NestJS API（终端一）：

```powershell
npm run dev:api
```

启动 Next.js（终端二）：

```powershell
npm run dev
```

Web 地址为 `http://127.0.0.1:12831`，API 默认监听 `http://127.0.0.1:3001`。Next.js 会通过 `next.config.ts` 将 `/yys-cbg-inspector/*` 请求代理到 NestJS。

## 服务器自部署

### 打包模式

本项目使用 Next.js 的 `output: "standalone"` 模式：

- Next.js 生成可由 Node.js 直接启动的 `.next/standalone/server.js`；
- `public/` 和 `.next/static/` 会在构建后自动复制到 standalone 目录；
- NestJS 会单独编译到 `dist/server/`，生产环境不再依赖 `tsx`；
- 不使用静态导出（`output: "export"`），因为项目需要 Server Actions、Next.js 服务端代理和 Node.js 运行时。

服务器需要运行两个进程：Next.js Web 服务和 NestJS API 服务。推荐只把 Next.js 端口暴露给公网，让 NestJS 监听本机地址。

构建机或服务器首次部署：

```powershell
npm ci
# 复制并填写 .env.production；NEXT_PUBLIC_* 和 API_SERVER_URL 要在构建前确定
npm run build
```

构建完成后的关键产物：

```text
.next/standalone/server.js       Next.js 生产服务
.next/standalone/.next/static/   Next.js 静态资源
.next/standalone/public/         public 目录资源
dist/server/main.js              NestJS 生产服务入口
```

Windows 分别启动两个进程：

```powershell
$env:NODE_ENV = "production"
$env:PORT = "3001"
$env:HOST = "127.0.0.1"
npm run start:api
```

另开一个 PowerShell 窗口启动 Next.js：

```powershell
$env:NODE_ENV = "production"
$env:PORT = "12831"
$env:HOSTNAME = "0.0.0.0"
npm run start:web
```

Linux 服务器可使用同等命令：

```bash
NODE_ENV=production PORT=3001 HOST=127.0.0.1 npm run start:api
NODE_ENV=production PORT=12831 HOSTNAME=0.0.0.0 npm run start:web
```

生产环境变量建议如下：

```dotenv
NEXT_PUBLIC_API_BASE_URL=/yys-cbg-inspector
NEXT_PUBLIC_ASSET_BASE_URL=/assets/
API_SERVER_URL=http://127.0.0.1:3001
```

其中 `NEXT_PUBLIC_*` 会在构建时写入浏览器代码，修改后必须重新执行 `npm run build`；`API_SERVER_URL` 是 Next.js 服务端代理目标。反向代理（如 Nginx）只需要转发 Next.js 的 `12831` 端口，NestJS 的 `3001` 端口不应直接暴露到公网。

如果使用 PM2、systemd 或 Docker，请将上面的两个进程分别托管，并为它们分别设置 `PORT`；不要让 Next.js 和 NestJS 共用同一个 `PORT` 环境变量。

### 对外静态资料接口

式神和御魂套装资料由 NestJS 提供 GET 接口，不通过 Server Action，也不依赖前端页面。部署后可通过 Next.js 同源代理访问：

```text
GET /yys-cbg-inspector/static/heroes
GET /yys-cbg-inspector/static/relic-suits
```

如果直接把 NestJS 暴露在独立域名或端口，则使用相同路径，例如：

```text
GET https://api.example.com/yys-cbg-inspector/static/heroes
GET https://api.example.com/yys-cbg-inspector/static/relic-suits
```

接口返回 JSON。式神接口返回 `schemaVersion`、`heroCount` 和 `heroesById`；御魂接口返回 `yuhun_list` 和 `two_suit_yuhun`，字段结构与前端 `src/lib/staticApi.ts` 使用的结构保持一致。

跨域浏览器调用 NestJS 直连地址时，请在 API 进程配置 `CORS_ORIGIN` 为调用方来源，多个来源用英文逗号分隔；服务端或同源调用不受此限制。若通过 Next.js 同源代理访问，则调用地址保持 `/yys-cbg-inspector/...`，不需要额外暴露 NestJS 端口。

## 数据库

首次部署时安装 MySQL 5.7，然后导入根目录 `database/yys_cbg_inspector.sql`：

```powershell
cd database
cmd /c "mysql --default-character-set=utf8mb4 -u root -p < yys_cbg_inspector.sql"
```

复制 `.env.example` 为本机 `.env`，填写 MySQL 连接信息。启动后端后，可访问 `http://127.0.0.1:3001/yys-cbg-inspector/health` 检查数据库连接。

数据库快照只包含静态游戏资料，不包含游戏账号密码、藏宝阁登录态、商品御魂库存或用户本地计算记录。

## 环境变量与敏感信息

- `NEXT_PUBLIC_*` 变量会进入浏览器端，只能存放公开地址，不能存放密码、令牌或私钥。
- `API_SERVER_URL` 仅用于 Next.js 服务端代理目标。
- 式神和御魂静态资料通过 NestJS 接口获取；账号商品详情通过 `src/actions/cbg.ts` 的 Next.js Server Action 获取。
- Server Action 统一使用 `next-safe-action` 封装，输入使用 `zod` 校验，页面按 `data`、`validationErrors` 和 `serverError` 处理结果。
- `MYSQL_PASSWORD` 只能写入本机 `.env`、系统环境变量或部署平台密钥管理服务。
- 生产环境应使用权限受限的专用 MySQL 账号，不要让应用长期使用 `root`，数据库端口不应直接暴露到公网。
- 提交前执行 `git status --short` 和 `git diff --check`，确认没有密码、密钥或运行日志进入版本控制。

## 代码约束

- 完整的 Next.js + NestJS 中文编写规范见 [NEXTJS-CODING-STANDARDS.md](NEXTJS-CODING-STANDARDS.md)。
- `app/` 只负责 Next.js 路由组合；业务页面位于 `src/features/`，可复用组件位于 `src/components/`。
- 页面和组件的样式、类型文件与实现文件按仓库 `AGENTS.md` 约定归属。
- 客户端交互和浏览器 API 仅位于明确的 Client Component 边界内。
- 页面不直接请求 CBG 商品详情接口；商品查询统一经过 Server Action，静态式神和御魂资料继续使用接口。
- NestJS 按模块、控制器、服务、DTO 分层；数据库表结构保持兼容，不在本分支执行破坏性迁移。
- 提交前至少执行 `npm run test`、`npm run build` 和 `git diff --check`。
