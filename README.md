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

生产启动：

```powershell
npm run build
npm run start:api
npm run start
```

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
