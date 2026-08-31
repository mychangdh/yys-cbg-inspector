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

开发环境 Web 地址为 `http://127.0.0.1:12831/yys-cbg-inspector/home`，API 默认监听 `http://127.0.0.1:3001/yys-cbg-inspector`。Next.js 通过 `basePath: "/yys-cbg-inspector"` 统一生成页面、Link 和静态资源的公开路径；生产环境由 Nginx 保留这个前缀并转发到 Next.js。

## 服务器自部署

### 打包模式

本项目使用 Next.js 的 `output: "standalone"` 模式：

- Next.js 生成可由 Node.js 直接启动的 `.next/standalone/server.js`；
- `basePath` 在构建时固定为 `/yys-cbg-inspector`，修改后必须重新生成部署产物；
- `public/` 和 `.next/static/` 会在构建后自动复制到 standalone 目录；
- NestJS 会单独编译到 `dist/server/`，生产环境不再依赖 `tsx`；
- 不使用静态导出（`output: "export"`），因为项目需要 Server Actions、Next.js 服务端代理和 Node.js 运行时。

服务器底层仍然运行两个进程：Next.js Web 服务和 NestJS API 服务。项目提供了一键启动入口，由一个 Node.js 父进程统一托管两个子进程；推荐只把 Next.js 端口暴露给公网，让 NestJS 监听本机地址。

构建机或服务器首次部署：

```powershell
npm ci
# 复制并填写 .env.production；NEXT_PUBLIC_* 要在构建前确定
npm run build
```

构建完成后的关键产物：

```text
.next/standalone/server.js       Next.js 生产服务
.next/standalone/.next/static/   Next.js 静态资源
.next/standalone/public/         public 目录资源
dist/server/main.js              NestJS 生产服务入口
```

执行 `yarn build` 或 `npm run build` 后，还会自动生成 `deployment/` 目录。该目录按照服务器上传结构整理好，包含 `.next/standalone/`、`dist/`、根目录 `node_modules`、standalone 内的运行依赖、启动脚本、`package.json`、锁文件以及本机存在的 `.env.production`。服务器部署时直接上传整个 `deployment/` 目录，不需要上传完整源码或根目录的完整 `.next/`，也不需要再次执行 `yarn` 安装依赖。

服务器进入 `deployment/` 目录后，设置 `NODE_ENV=production`，直接执行 `yarn start` 即可同时启动两个服务；服务器不需要重新安装依赖或执行 Next.js 构建。排查单个服务时仍可分别使用 `yarn start:api` 和 `yarn start:web`。如果构建机没有 `.env.production`，请在服务器部署目录中手动补充该文件；该文件包含敏感配置，不要提交到 Git 或上传到公共网盘。

由于该部署方式会携带构建机的 `node_modules`，构建机与服务器应使用相同的操作系统、CPU 架构和兼容的 Node.js 版本。Windows 构建的依赖直接上传到 Linux 可能因原生模块或平台专属依赖启动失败；跨平台部署时应在 Linux、WSL 或 Docker 中生成部署包。

Windows / PowerShell 一键启动：

```powershell
cd C:\MyApps\yys-cbg-inspector-nextjs-refactor\deployment
$env:NODE_ENV = "production"
yarn start
```

Linux 服务器一键启动：

```bash
cd /www/wwwroot/yys-cbg-inspector2
NODE_ENV=production yarn start
```

使用 `yarn start` 时需要同时上传 `scripts/start-all.mjs`、`scripts/start-api.mjs`、`scripts/start-next-standalone.mjs` 和 `scripts/production-env.mjs`；启动脚本会固定加载并应用 `.env.production`，不会因为未设置 `NODE_ENV` 而误读 `.env.development`，也不会被宝塔或 shell 中同名变量悄悄覆盖。Next.js 启动时仍会避免使用 Linux 自动注入的云主机名称。

生产环境变量建议如下：

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://39.96.207.211:12377/yys-cbg-inspector
NEXT_PUBLIC_ASSET_BASE_URL=/yys-cbg-inspector/assets/
WEB_PORT=12831
WEB_HOSTNAME=0.0.0.0
```

其中 `NEXT_PUBLIC_*` 和 `basePath` 会在构建时写入浏览器代码，修改后必须重新执行 `npm run build`。项目的生产构建脚本会强制使用 `.env.production` 中的 `NEXT_PUBLIC_API_BASE_URL`，覆盖构建机残留的开发环境变量，并在打包前检查浏览器静态产物；地址不正确时会直接中止，不会生成错误部署包。`PORT` 和 `HOST` 用于 NestJS，`WEB_PORT` 和 `WEB_HOSTNAME` 用于 Next.js；`npm run start:web` 会从 `.env.production` 读取 Web 配置，并忽略 Linux 自动注入的主机名。Nginx 需要在同一个子路径下区分 API 和 Web：将 `/yys-cbg-inspector/health`、`/yys-cbg-inspector/static/`、`/yys-cbg-inspector/cbg/` 转发到 NestJS 的 `3001` 端口，其余 `/yys-cbg-inspector/` 页面、`/yys-cbg-inspector/_next/` 静态资源和 `/yys-cbg-inspector/assets/` 转发到 Next.js 的 `12831` 端口。启用 `basePath` 后，页面代理必须保留 `/yys-cbg-inspector` 前缀，不能再用追加 URI 斜杠的方式去掉该前缀。建议使用 `$host` 设置 `Host` 与 `X-Forwarded-Host`，避免 Server Actions 的来源校验出现主机名和端口不一致。NestJS 的 `3001` 端口不应直接暴露到公网。

Nginx 分流示例：

```nginx
location = /yys-cbg-inspector {
    return 301 /yys-cbg-inspector/home;
}

location = /yys-cbg-inspector/ {
    return 301 /yys-cbg-inspector/home;
}

# API 路径保留 /yys-cbg-inspector 前缀，转发到 NestJS。
location ^~ /yys-cbg-inspector/health {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location ^~ /yys-cbg-inspector/static/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location ^~ /yys-cbg-inspector/cbg/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# Next.js 生成的脚本、样式和 Server Actions 使用 basePath 下的 /yys-cbg-inspector/_next/。
location ^~ /yys-cbg-inspector/_next/ {
    proxy_pass http://127.0.0.1:12831;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# 页面公开地址带前缀；basePath 要求转发时保留 /yys-cbg-inspector。
location ^~ /yys-cbg-inspector/ {
    proxy_pass http://127.0.0.1:12831;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# 根路径和其他未匹配路径不能打开应用页面。
location / {
    return 404;
}
```

如果使用 PM2 或 Docker，可以直接托管 `yarn start`；如果选择分别托管两个服务，仍需为它们分别设置端口，不要让 Next.js 和 NestJS 共用同一个 `PORT` 环境变量。

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
