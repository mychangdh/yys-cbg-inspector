# Next.js 项目代码编写规范

> 本规范根据 Next.js 官方 App Router 文档整理，并结合本项目的 Next.js + NestJS 架构落地。
> 官方文档访问日期：2026-08-30。

## 1. 适用范围与优先级

本规范适用于本项目根目录下的 Next.js 页面、React 组件、公共模块、NestJS 服务及其配置。

代码实现的优先级如下：

1. 业务正确性与数据安全。
2. Next.js / React 运行边界正确。
3. TypeScript 类型完整、可验证。
4. 目录归属清晰、依赖方向稳定。
5. 性能、可维护性与代码格式统一。

当本规范与 Next.js 新版本官方文档冲突时，以官方文档为准，并在本文件记录调整原因。

## 2. 项目目录约定

本项目是单一根目录项目，不再拆分为独立的前端、后端目录：

    app/                    # Next.js App Router 路由入口，只负责页面路由编排
    src/
      components/           # 跨页面复用的 React 组件
      features/             # 业务页面与领域功能模块
      lib/                  # 领域逻辑、API 客户端、纯函数与计算器
      store/                # Redux store 与跨页面状态
      styles/               # 全局 reset、设计令牌与应用级样式
      types/                # 跨模块公共类型
    server/                 # NestJS API 服务、模块、控制器与服务
    public/                 # Next.js 静态资源
    database/               # MySQL 快照与数据库说明

约定：

- **app/** 采用文件系统路由；目录名对应 URL 片段，**page.tsx** 才会使路由公开。
- **app/page.tsx**、**app/layout.tsx**、**app/loading.tsx** 等特殊文件遵循 Next.js 文件约定。
- **app/** 页面入口只做路由级编排；复杂 UI、状态和业务逻辑放在 **src/features/** 或 **src/components/**。
- 业务文件可以放在 **app/** 外部；本项目统一放在 **src/**，避免与 Next.js 的 **pages/** 路由约定混淆。
- 不在本项目重新引入 **pages/**、React Router 或自定义路由系统。
- **server/** 是 NestJS 服务，不在 Next.js Client Component 中直接导入。
- 页面和复用组件统一使用 PascalCase 功能文件夹；实现入口为 **index.tsx**，专属样式为 **index.module.scss**。Props、事件和状态类型就地声明或放入 **src/types/**，不在组件目录创建 **index.types.ts**。

## 3. App Router 文件规范

### 3.1 页面与布局

- 页面文件使用 **page.tsx**，默认导出页面组件。
- 公共页面骨架使用 **layout.tsx**；布局通过 **children** 接收下一级页面。
- 加载状态使用同路由段的 **loading.tsx** 或更近的 **Suspense**，不得只依赖空白页面等待数据。
- 业务异常使用同路由段的 **error.tsx**；资源不存在使用 **not-found.tsx**。
- 页面入口不要重复声明菜单、路由路径或全局状态；这些内容放入对应的公共配置或 store。
- 仅当确实需要 Next.js Route Handler 时才创建 **route.ts**；本项目既有 API 统一由 NestJS 提供。

### 3.2 路由组织

- 使用目录表达路由层级，使用路由组 **(group)** 做组织但不改变 URL。
- 使用私有目录 **\_folder** 存放不应成为路由的实现细节。
- 页面跳转优先使用 **next/link**，以获得预取和客户端过渡。
- 只有在提交后跳转、条件跳转等必须编程控制的场景使用 **useRouter()**。
- **usePathname()** 只用于客户端的当前路径判断；不要自行维护第二套路由状态。

## 4. Server Component 与 Client Component

Next.js App Router 默认使用 Server Component。必须按能力选择运行端：

### 4.1 默认使用 Server Component

页面、布局和静态内容默认保持 Server Component，用于：

- 服务端数据读取和靠近数据源的请求。
- 使用 API 密钥、数据库凭据等服务端私密信息。
- 减少发送到浏览器的 JavaScript。
- 服务端渲染、流式输出和 SEO 友好的页面内容。

### 4.2 需要时才使用 Client Component

只有在使用以下能力时，才在文件顶部、所有 import 之前添加 **"use client"**：

- **useState**、**useEffect** 等客户端状态或生命周期。
- 点击、输入等事件处理器。
- **window**、**document**、**localStorage** 等浏览器 API。
- Redux、Context 或其他客户端自定义 Hook。

要求：

- **"use client"** 是模块边界，不要在每个子组件中重复添加。
- Client Component 的 props 必须可被 React 序列化；不得从 Server Component 直接传递函数、类实例或不可序列化对象。
- Provider 尽量只包裹真正需要它的 **children**，不要无条件包裹整个 **html** 文档。
- 服务端模块与浏览器模块不得相互越界导入；数据库访问、服务端凭据和 NestJS 模块不得进入客户端包。

## 5. 数据请求、缓存与错误处理

本项目的数据访问边界：

- 式神和御魂静态资料使用 NestJS 接口获取，并由客户端负责本地缓存。
- 账号商品详情使用 `src/actions/cbg.ts` 中的 Next.js Server Action 获取，统一通过 `src/lib/safeAction.ts` 的 `next-safe-action` 客户端定义，并使用 `zod` 校验输入；页面不得直接请求 CBG 上游接口。
- 健康检查属于服务运维接口，保留在 NestJS，不作为页面业务数据请求。

- 数据请求应放在离数据源最近的服务端模块或 NestJS 服务中。
- 客户端只在交互确实需要时请求 API；请求入口统一复用 **src/lib/apiClient.ts**。
- API 入参必须有 DTO 或显式类型校验；不得把未经校验的查询参数直接传给数据库或上游服务。
- 服务端返回值、错误码和错误消息保持稳定；异常必须经过统一异常处理，不得把堆栈或敏感信息返回给浏览器。
- 页面必须考虑加载、空数据、错误和成功反馈四类状态。
- 需要流式加载的路由使用 **loading.tsx** 或局部 **Suspense**，不要通过手写阻塞逻辑代替框架能力。
- 修改缓存、请求重试或数据刷新策略时，必须说明数据一致性和失败回滚影响。

## 6. TypeScript 规范

- 新增或修改代码必须提供明确的输入、输出、状态和回调类型。
- 优先使用 **unknown**、联合类型、类型守卫和泛型；禁止用 **any** 掩盖类型问题。
- 类型很少且只服务当前实现文件时就地声明；多个文件或页面共享的 Props、事件、回调和领域类型统一放入 **src/types/**，不在组件目录创建专属类型文件。
- 页面已经掌握数据且只负责直接渲染时，不为传递一组值额外创建只转发 Props 的中间层；只有跨边界复用、状态隔离或职责清晰时才定义 Props。
- 类型只导入类型时使用 **import type**，避免运行时产生无用依赖。
- 跨多级目录引用优先使用已配置的 **@/** 别名；近邻文件使用清晰的相对路径。
- 不得通过 **typescript.ignoreBuildErrors**、**@ts-ignore** 或强制断言绕过可修复的类型错误。
- 每次交付至少运行类型检查、相关测试、ESLint/Prettier 和 **git diff --check**；本项目协作禁止自动执行生产构建、打包或其他会触发构建流程的命令。

## 7. 样式与资源规范

- 除 **src/styles/** 中的 reset、设计令牌、应用壳层、第三方覆盖和真正跨页面复用的规则外，页面和组件私有样式全部使用同目录 **index.module.scss**。实现文件必须显式导入并实际使用对应的 CSS Module；不能只改扩展名，也不能继续依赖业务全局选择器。
- 组件样式使用 SCSS 的嵌套、变量、混入等能力维护，不把组件样式堆到全局文件。兼容第三方 DOM 类名时，只能在所属模块中用有局部类作为边界的 **:global(...)**。
- 全局样式只保留 reset、设计令牌、根节点布局、滚动条、第三方覆盖和跨页面动画。
- 避免 **!important** 和无边界的全局选择器；修正样式归属和加载顺序，而不是提高选择器优先级掩盖问题。
- 优先使用 **next/image** 处理图片：必须提供有意义的 **alt**；远程图片必须配置精确的 **remotePatterns**；使用 **fill** 时父元素必须具备定位上下文。
- 静态资源放在 **public/** 并使用稳定的绝对路径；禁止把用户数据、凭据或运行时生成文件提交到 **public/**。

## 8. 环境变量与安全

- **.env**、**.env.local**、**.env.production**、**.env.development** 等本地环境文件不得提交。
- 只有明确需要暴露到浏览器的值才使用 **NEXT_PUBLIC_** 前缀；这类值会在构建时写入客户端包，不得包含密码、令牌或内部地址。
- 数据库凭据、上游请求凭据和服务端地址只在 NestJS 或 Next.js 服务端代码中读取。
- 新增环境变量必须同步更新 **.env.example**，说明用途和是否允许暴露到客户端。
- 不在日志、异常响应、测试快照或 README 中输出真实密码、Cookie、账号数据和登录态。

## 9. 命名、依赖与注释

- React 组件目录和组件名称使用 PascalCase；普通目录、Hook、工具和服务使用项目现有 camelCase 约定。
- 一个 **.tsx** 文件只承载一个主要 React 组件；页面和可复用组件使用 PascalCase 文件夹及 **index.tsx** 入口，第二个可复用单元必须拆分到自己的文件夹并提供自己的 **index.module.scss**。工具、算法和配置仍按功能使用语义文件名，不创建空文件夹。
- 公共聚合入口使用 **index** 命名；入口文件只负责导出，不承载业务实现。
- 优先复用现有模块；引入新依赖前先确认必要性、许可证、包体积和维护成本。
- 不要过度拆分页面、组件或算法；只有接近两百行、职责明显分离、需要复用或需要独立测试时才拆分，避免只转发 Props 或只导出常量的空壳文件。
- 注释使用中文，说明业务意图、边界条件、兼容性约束和不容易从代码看出的原因，不重复描述显而易见的语句。
- 不提交 **.log** 文件；运行日志输出到终端或系统临时目录。

## 10. 提交前检查清单

- [ ] 路由是否使用 **app/** 文件约定，且没有重新引入 React Router。
- [ ] 是否只在需要交互或浏览器 API 的最小边界使用 **"use client"**。
- [ ] Server Component 是否误导入了浏览器专属模块、数据库凭据或 NestJS 实现。
- [ ] 页面是否具备加载、空态、错误和成功状态。
- [ ] API 入参、异常响应和上游失败是否经过校验与统一处理。
- [ ] 图片是否使用 **next/image** 或明确记录了无法使用的原因。
- [ ] 环境变量是否区分服务端变量与 **NEXT_PUBLIC_** 公共变量。
- [ ] 组件是否使用 PascalCase 文件夹/index.tsx，样式是否使用同目录 index.module.scss，且 TSX 引用已同步更新。
- [ ] 类型检查、相关测试、ESLint/Prettier 是否通过。
- [ ] 是否存在业务全局样式、失效旧引用或无效空文件。
- [ ] **git diff --check** 是否通过，且没有修改任务范围外的分支或文件。

## 11. 官方依据

- [App Router](https://nextjs.org/docs/app)：App Router 基于文件系统路由，并使用 Server Components、Suspense 等能力。
- [Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)：目录、文件约定、路由组、私有目录与代码组织方式。
- [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)：page、layout 和 children 的职责。
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)：服务端/客户端边界、Provider 和可序列化 props。
- [use client 指令](https://nextjs.org/docs/app/api-reference/directives/use-client)：客户端入口和使用条件。
- [Link Component](https://nextjs.org/docs/app/api-reference/components/link)：预取和客户端导航规范。
- [useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router)：仅在需要编程式导航时使用。
- [Image Component](https://nextjs.org/docs/app/api-reference/components/image)：图片尺寸、替代文本、远程图片与布局稳定性。
- [TypeScript 配置](https://nextjs.org/docs/app/api-reference/config/typescript)：Next.js 类型检查与构建行为。
- [Environment Variables](https://nextjs.org/docs/pages/guides/environment-variables)：环境变量加载、NEXT_PUBLIC_ 暴露规则与版本控制注意事项。
- [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)：服务端请求、流式加载和 loading.tsx / Suspense。
