# henjihenji.com 重构开发方案

> 状态：已定方案。第 0 阶段的 TOY 实测已完成（见第 9 节），手机版工具外壳还要补进设计系统。
> 视觉与交互以「雾林设计系统」和「雾林全站原型」为准，入口见 [`rules/project-context.md`](../rules/project-context.md)。本文只写怎么做。

## 1. 这是什么

痕继痕迹的个人主页：介绍本人，放视频和其他作品（以后会有摄影等），也是作者自己写的小工具的家。它同时是作品集和工具站，两种页面共用一个顶栏、一套组件和同一组过渡。

同一份代码发布到两个地方：

| 目标 | 地址 | 放什么 | 访客从哪来 |
|---|---|---|---|
| 网站 | henjihenji.com（Cloudflare Pages） | 全部内容：主页、作品、工具、关于 | 搜索、分享链接、B 站简介 |
| B 站 TOY | `www.bilibili.com/toy/<路径>/index.html` | 工具：工具箱合集，以及单个工具 | B 站 App 里，多数在手机上，常从绑定的视频点进来 |

TOY 上不放完整主页：访客本来就在你的 B 站频道里，视频列表和关注入口在那里是多余的。TOY 放的是能直接用的东西。

## 2. 技术栈

每个职责只用一个库。版本以锁文件为准；2026-11 核对的最新稳定版是 React 19.3、React Router 8.5、Vite 8.3。

| 职责 | 选用 | 说明 |
|---|---|---|
| 界面 | React + TypeScript | 生态最全：下面几项都是 React 原生的 |
| 路由与构建 | React Router 8 + Vite | 网站：框架模式 `ssr: false` + `prerender: true`，每个页面构建时输出静态 HTML，不需要服务器。TOY：同一批页面组件，用哈希路由打成单个 `index.html` |
| 样式 | Tailwind CSS v4 | 用 `@theme` 映射雾林令牌 |
| 基础组件 | shadcn/ui | 源码进项目，按雾林样式改；命令面板用它的 Command（cmdk），轻提示用 Sonner |
| 图标 | Lucide | |
| 动画 | Motion（`motion/react`） | 组件内动效；页面过渡用 View Transitions |
| 工具内状态 | Zustand | 每个工具一个 store；持久化走平台适配层，不直接写 localStorage |
| 数据校验 | Zod | 内容数据（视频、摄影、工具登记）在构建时校验 |
| 字体 | MiSans 网页字体（按字切片、自托管） | 页脚注明“字体：MiSans”，这是许可要求。字体文件还没接入，目前用令牌里的系统字体回退 |
| 测试 | Vitest + Playwright | 纯逻辑用 Vitest；两个发布目标各跑一遍 Playwright 冒烟 |
| 代码检查 | TypeScript 严格模式 + ESLint | ESLint 禁止页面和工具直接用 `window.open`、`localStorage`、`location`，必须走平台适配层 |
| TOY 发布 | B 站官方 Toy CLI（`toy`） | 创建、更新、查询、统计、绑定视频都用它；类型声明用官方的 `toy.d.ts` |

为什么不用 Astro：这个站的主体是工具和贯穿全站的交互（Ctrl K、主题、轻提示、常驻顶栏、共享元素过渡），整站一个 React 应用最顺。TOY 只接受单个 `index.html` 加页面内跳转，多页面架构在 TOY 上反而难做。

## 3. 两个发布目标的差异

依据：B 站 TOY 官方使用手册、常见问题、JS SDK 和 CLI 文档（2026-11-24 读取）。

| | 网站 | TOY |
|---|---|---|
| 路由 | 浏览器地址（`/tools/watermark/`），每页预渲染 | 哈希路由（`index.html#/tools/watermark`），官方推荐：刷新不 404，后退可用 |
| 深链 | 直接用地址 | 分享和二维码只能带 query，所以用 `index.html?p=/tools/watermark`，启动时转成哈希路由 |
| 资源路径 | 根路径 `/` | 相对路径（Vite `base: "./"`），页面跑在 `/toy/<路径>/` 下 |
| B 站内跳转 | 普通链接 | SDK `toy.navigate({ type, id })`，在 App 里原生打开视频、空间、动态（需要用户点击触发） |
| 其他外链 | 普通链接 | 普通链接和 `window.open` 都能打开，返回后还在 TOY 里；仍统一由平台适配层打开 |
| 保存图片 | 浏览器下载 | SDK `saveImageToAlbum`（只在 App 里有；base64 上限 5MB，建议 2MB 内，所以先压成 JPEG）；SDK 存完没有提示，要自己弹“已存到相册”；没有 SDK 时显示图片让用户长按保存 |
| 分享 | 复制链接 | SDK `share`（分享当前 TOY 内的页面）、`sharePicture`（分享图片本身，≤2MB）、`getQrCode` |
| 设置记忆 | localStorage（按工具加前缀） | SDK 云存储：按“用户 + 本 TOY”隔离，最多 128 个键，每个值 ≤1KB，有频率限制，只在停止编辑后或页面隐藏时写；较大的输入（名单、文本）存 localStorage，防止被侧滑退出或重新加载后丢失 |
| 复制 | 剪贴板接口 | 剪贴板接口被拒；先试 `execCommand("copy")`，不行就选中文本让用户长按复制 |
| 返回 | 浏览器后退 | 页面内的返回按钮走哈希历史；**手机侧滑返回会直接退出 TOY**，所以页面层级最多“列表 → 工具”一层，工具状态随时保存 |
| 全屏 | 浏览器全屏 | SDK `setContainerMode({ immersive })`；安全区和可用尺寸用 `getContainerState` / `onContainerChange` |
| 主页数据 | 构建时拉取的视频数据 | 用不到；如需作者资料、关注状态，SDK 有 `getAuthorProfile`、`getAuthorRelation` |
| 更新 | 推送 `main` 自动部署 | 每次都要构建、检查、预览、你确认，再提交审核 |
| 包体 | 不紧张 | 当前账号上限 140MB（以发布页显示为准）；只发布白名单后缀，`.avif`、`.txt`、`.webmanifest`、`.map` 等会被过滤 |

这些差异全部收进一个**平台适配层**（`src/platform/`，接口在 `contract.ts`）。页面和工具只调用它（`import { platform } from "~/platform"`），不判断自己在哪个平台：

```ts
export interface Platform {
  kind: "web" | "toy";
  openBili(type: "video" | "space" | "opus", id: string): Promise<void>;
  openExternal(url: string): void;
  // 网站：Blob 原样下载、画布编码后下载；TOY：一律转白底 JPEG（尽量 ≤2MB，绝不超 5MB）存相册，SDK 没提示，调用方按结果弹轻提示
  saveImage(image: HTMLCanvasElement | Blob, filename: string): Promise<"saved" | "downloaded" | "shown">;
  // 网站：任意文件下载；TOY：image/* 走 saveImage，其他返回 "unsupported"（App 里的下载没验证过），调用方提示去网站
  saveFile(blob: Blob, filename: string): Promise<"saved" | "downloaded" | "shown" | "unsupported">;
  // TOY 里剪贴板接口被拒：execCommand → 选中 source 让用户长按复制；都不行返回 "failed"
  copyText(text: string, source?: HTMLElement | null): Promise<"copied" | "selected" | "failed">;
  shareImage?(canvas: HTMLCanvasElement): Promise<void>;
  storage: {
    settings(namespace: string): KeyValueStore; // 小设置：TOY 走云存储（合并写入、页面隐藏时立即写，单值 ≤1KB），网站走 localStorage
    local(namespace: string): KeyValueStore;    // 名单、文本等较大的输入：两边都存 localStorage
    flush(): Promise<void>;
  };
  setImmersive(on: boolean, element?: HTMLElement | null): Promise<boolean>; // TOY 用 SDK 沉浸模式，网站用浏览器全屏
  onImmersiveChange(listener: (on: boolean) => void): () => void;
}
// KeyValueStore = { get<T>(key), set<T>(key, value), remove(key) }，值都是 JSON
```

工具不直接调用 storage，而是用 zustand 的 `persist` 加 `toolStorage(工具 id, "settings" | "local")`（`src/shell/tool/persist.ts`）。TOY 云存储另外写一份本机镜像，读取时取更新的那份。没拿到官方的 `toy.d.ts`，`src/platform/types/toy.d.ts` 是按第 0 阶段实测过的调用方式手写的最小声明，拿到官方声明后替换。

SDK 不提供用户 UID，`getUserProfile` 要用户确认才返回头像和昵称；这几个工具都用不到用户身份，不调用它。

## 4. 信息结构

| 网站地址 | 页面 | TOY 里有没有 |
|---|---|---|
| `/` | 首页：我是谁、最新视频、小工具、作品精选、关注方式 | 工具箱合集的首页换成“工具列表 + 一句介绍 + 关注” |
| `/works/` | 作品：视频、摄影、其他，按类别切换 | 不放 |
| `/works/videos/` | 全部视频 | 不放 |
| `/works/photos/` | 摄影（第 6 阶段） | 视情况 |
| `/tools/` | 工具箱 | 有 |
| `/tools/<id>/` | 单个工具 | 有（合集里一页，或单独一个 TOY） |
| `/about/` | 关于：介绍、设备、联系方式 | 不放 |
| `404` | 起雾了 | 不需要 |

新增一种作品（如摄影）= 加一个内容集合（数据 + Zod 结构）+ 一个列表页 + 首页精选里的一行，不改其他页面。

## 5. 代码结构

```
src/
  web/                    网站入口（React Router 框架模式的 appDirectory）
    root.tsx              HTML 外壳、主题、字体、View Transitions
    routes.ts             由页面登记表生成的路由
  toy/
    entry.tsx             TOY 入口：哈希路由，挂同一批页面；处理 ?p= 深链
  shell/                  全站外壳：顶栏、页脚、命令面板、主题切换、轻提示、过渡
    tool/                 工具外壳：桌面布局和手机布局（底部抽屉）
  design/
    tokens.css            雾林令牌，唯一的数值来源
    global.css            Tailwind 入口与基础样式
  ui/                     shadcn 组件（改成雾林样式）与雾林自有组件
  platform/               平台适配层：web.ts、toy.ts、index.ts；types/toy.d.ts 用官方声明
  pages/                  首页、作品、工具箱、关于（只组合 shell、ui 和内容数据）
  content/
    schema.ts             Zod 结构
    videos.json           构建时生成；拉取失败沿用上一次
    photos/               摄影数据（第 6 阶段）
  tools/
    registry.ts           工具登记：id、名称、图标、状态、关键词、能否上 TOY
    watermark/
      meta.ts
      Tool.tsx            界面：只用 ui/、shell/ 和 platform/
      logic/              纯函数：不碰 React 和 DOM，Vitest 测
      store.ts
    random-picker/
    text-batch/
scripts/
  fetch-videos.ts         拉取 B 站视频数据
  toy.ts                  TOY 打包、检查、生成封面和图标、调用官方 CLI
toy/
  <目标>.json             每个 TOY 的记录：id、路径、标题、分类、可见性（更新时据此保持同一个地址）
```

依赖方向只能往下：`pages`、`tools` → `shell`、`ui`、`platform`、`content` → `design`。几条硬规矩：

- 工具之间互不引用。删掉一个工具目录、去掉登记表里的一行，两个目标都照常构建。
- 首页、工具箱、命令面板、路由和 TOY 打包都从 `tools/registry.ts` 读工具列表。
- 颜色、间距、圆角、时长只从令牌取，业务代码里不写十六进制颜色和魔法数字。
- 页面和工具不直接碰 `window.open`、`localStorage`、`location`，由 ESLint 拦。

## 6. 页面过渡与动效

- 两个目标都用 React Router 的 `viewTransition`（`<Link viewTransition>`、`navigate(to, { viewTransition: true })`），哈希路由同样生效，浏览器不支持时直接切换。工具卡片的图标块和工具名用 `tool-<id>-icon`、`tool-<id>-name` 做共享元素（`src/ui/vt.ts`），顶栏是 `site-head`。
- 主题切换的圆形扩散、雾散入场、按压反馈等，全部按设计系统「动效」一节，原型里已经实现过一遍，可以直接参考。

## 7. 手机优先的工具布局

TOY 的访客几乎都在手机上，所以每个工具都先有手机布局，再有桌面布局。第 0 阶段已经做出第一版（随机抽取）：

- 顶栏：返回、工具图标和名字、全屏。
- 舞台占满中间，四角取景框。
- 底部抽屉：收起时只露出把手和一行摘要（如“名单 10 人 · 已抽 1 人”），点一下或往上拖展开全部设置；开始操作时自动收起。
- 主按钮固定在最底下，留出安全区。
- 文件从相册选、拍照或粘贴进来；导出走平台适配层。

正式开工时把这版补进设计系统，再按它实现其他工具。

已实现为 `src/shell/tool/ToolShell.tsx`：按视口宽度（768px）选桌面或手机布局，工具只提供控制栏、舞台、一行摘要和主操作（快捷键默认 Ctrl/⌘ Enter，可改成空格）。工具界面只在浏览器里渲染：网站预渲染的工具页只有顶栏和占位，标题和描述在路由的 meta 里。

## 8. 一份代码，两种打包

TOY 不靠“发布前转换网站产物”实现，而是在构建时就打出两种包。网站产物是多个 HTML、根路径和浏览器路由，事后改写容易漏，所以从源头分开：

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发网站 |
| `npm run build:web` | 构建网站，输出 `build/client/`（Cloudflare Pages 的输出目录） |
| `npm run toy -- <目标>` | 打 TOY 包并检查，输出 `dist-toy/<目标>/`，**不上传** |
| `npm run toy -- <目标> --preview` | 打包、检查后打印预览要执行的官方 CLI 命令，不上传（预览子命令还没记录，以 `toy --help` 为准） |
| `npm run toy -- <目标> --publish` | 打包、检查后打印 `toy create …` 或（记录里有 id 时）`toy update <id> <目录>`，不上传 |
| `npm run check` | 路由类型生成、类型检查、ESLint、Vitest |
| `npm run e2e` | 先构建两边，再用 Playwright（本机 Chrome）跑：网站桌面和手机各一遍；TOY 工具箱包挂在本地 `/toy/test/` 路径下按 400 × 713 跑一遍 |

`toy` 脚本做的事：

1. 用 TOY 模式构建：相对路径、哈希路由、注入官方 SDK（`toy-sdk.js`）、选择打哪些页面（工具箱合集或单个工具）。
2. 检查：根目录有 `index.html`；没有会被平台过滤的文件后缀；HTML、CSS、JS 里没有 `/` 开头的本地资源；引入了 SDK；有 `<title>`；总大小不超过上限。任何一项不过就停下。
3. 生成封面（4:3，1200 × 900）和图标（1:1，500 × 500）：用雾林样式的模板自动截图，每个工具一套，放在 `dist-toy/<目标>-assets/`。
4. 脚本本身从不上传，只打印要执行的官方 CLI 命令：`toy create <目录> --category TOOL --visibility <可见性> --poster … --icon …`，或 `toy update <id> <目录>`；你确认后自己运行，结果写回 `toy/<目标>.json`。

发布：

- **网站**：推送 `main` 后由 Cloudflare Pages 自动构建上线。推送就是上线，所以每次推送前先找你确认。其他分支自动生成预览地址。
- **TOY**：任何上传（包括只拿预览）、创建、更新都要你先同意。每次发布都会生成一条绑定的动态：“所有人可见”会进 TOY 广场、粉丝关注流和你的主页；“链接访问”只有拿到链接的人能看；“密码访问”还会隐藏动态的封面和名称。路径发布后不能改，第一次起名要定好。

## 9. 第 0 阶段

### 已完成（本地，未上传）

- 读完官方使用手册、常见问题、JS SDK、CLI 文档，结论已写进第 3 节和第 8 节。
- 做了一个探针包（本机 `.local/toy-probe/`，不进仓库），用的就是正式方案的技术栈：React 19.3 + React Router 8.5 + Vite 8.3，TOY 模式打包。
  - 包含：运行环境自动检测页（环境、浏览器能力、存储、网络、SDK）；手动测试按钮（B 站跳转、外链、存相册、分享图片、分享深链、二维码）；手机版工具外壳（随机抽取）。
  - 打包结果：4 个文件，336KB；首屏脚本 gzip 后约 104KB，大头是 React 和 React Router 本身。
- 写了打包检查脚本，并故意喂了一个错误的包确认它能拦住：被过滤的 `.avif`、根路径资源、缺 SDK 都报错停下。
- 在本地模拟的 `/toy/probe-local/` 路径下跑通：资源能加载；哈希路由跳转、刷新后留在原页、`?p=/tool` 深链都正常；SDK 能从 B 站 CDN 加载。

### 已上传（2026-11-24，经你同意）

- 装好官方 Toy CLI v0.6.6 并用 OAuth 登录。
- 先只上传拿预览：页面跑在独立来源 `www.bilibilitoy.com` 的 iframe 里，读不到 B 站登录 cookie，本地存储和主站隔开（但所有 TOY 很可能共用这个来源，仍然不放密钥）；外部请求和图片都通，没有内容安全策略拦截。预览状态下 SDK 拿不到 TOY 的 id，作者资料、云存储写入、二维码都不可用，所以必须正式发布才能测全。
- 以“密码访问”提交审核：标题“痕迹工具箱测试”，路径 `henji-toy-probe`，id `58660860469248`。访问密码在本机 `.local/toy-probe/toy-assets/` 里。

### App 实测结果（2026-11-24，手机 B 站 App）

- 页面跑在 `www.bilibilitoy.com` 的 iframe 里，UA 带 BiliApp；可用区域 400 × 713（3 倍屏）。App 自己占了顶栏和底部互动栏，CSS 安全区和 SDK 报的安全区都是 0，所以页面不用再为刘海和底部横条留空。
- 全部 SDK 能力可用，包括存相册、分享、分享图片、二维码、关闭页面、全屏模式、容器状态、云存储；作者资料能读到粉丝数，云存储能写能读。
- View Transitions、backdrop-filter、`:has`、容器查询、color-mix 都支持；设计系统里的效果在 App 里都能用。
- 读不到 B 站登录 cookie；localStorage 和 IndexedDB 可用。
- 能请求 henjihenji.com 和 jsDelivr，能加载外站图片，没有内容安全策略拦截。
- **剪贴板接口被拒**：`navigator.clipboard.writeText` 存在但调用失败。TOY 里的“复制”要先试 `document.execCommand("copy")`，再不行就选中文本让用户长按复制；平台适配层加一个 `copyText`。
- `navigator.share` 不可用，分享统一走 SDK。
- 从工具页回到检测页时是在 TOY 内部后退（哈希变为空），没有直接退出。

### 手动按钮（作者在 App 里逐个点过）

- SDK 跳转到 B 站空间：正常，返回后还在 TOY 里。
- 普通外链和脚本打开外链：都能打开 henjihenji.com，返回后还在 TOY 里。旧说法里“外链会被平台改坏”没有出现。
- 存相册：图片存进去了，但 SDK 不给任何提示，存完要自己弹“已存到相册”。
- 分享图片、分享链接：都弹出 B 站分享面板。
- 生成二维码：正常。
- 返回：页面左上角的返回按钮能在 TOY 内后退；**手机侧滑返回会直接退出整个 TOY**，不走页面内的历史记录。
- 手动按钮的日志在离开再回来后没了，说明从 App 其他页面返回时 TOY 可能被重新加载；工具状态不能只放在内存里。

结论：TOY 这条路走得通，第 0 阶段的 TOY 部分完成。


### 已有的 TOY

账号下已经有一个已发布的工具 TOY：“转个格式 - 无需上传，在浏览器里转换文件格式”（路径 `gszh`，链接访问，2026-06 发布）。它也是纯前端小工具，源码在作者本机的另一个项目里。重构时把它当作已有工具迁进统一外壳，用 `toy update` 更新原来那个 TOY，地址不变。

### 旧技能的过时说法

本机的 `bili-toy-publisher` 技能有三处和官方文档对不上：它说不能用 `#` 路由（官方现在推荐哈希路由），说包体建议 20MB（你的账号上限是 140MB），命令行脚本默认连的是 B 站内部地址。TOY 相关的事以官方文档和官方 CLI 为准。

## 10. 阶段

每个阶段做完都能单独上线，旧地址在最后一步之前一直可用。

| 阶段 | 内容 | 上线 |
|---|---|---|
| 0 | TOY 规则调研、探针包、打包检查脚本、手机版工具外壳（本地已完成）；在 App 里实测（待你同意上传） | TOY 预览或密码访问 |
| 1 | 项目骨架：两种打包、令牌、ui 组件、shell、平台适配层、检查与冒烟测试；Cloudflare 构建设置改为 `npm run build:web` / `build/client` | 网站预览分支 |
| 2 | 首页、作品（视频，构建时拉取）、关于；替换现在的首页 | 网站 |
| 3 | 工具外壳（桌面 + 手机）和随机抽取（最简单，先跑通整条链路） | 网站 + 第一个 TOY |
| 4 | 迁入水印工具和“转个格式”；TOY 版接存相册和分享图片；`wmt.henjihenji.com` 301 到新地址；“转个格式”用 `toy update` 更新原 TOY | 网站 + TOY |
| 5 | 迁入批量文本处理；TOY 版做不做、怎么存接口密钥，按第 0 阶段的实测结果定 | 网站（TOY 待定） |
| 6 | 摄影作品：图片放 Cloudflare R2，上传时生成多尺寸（TOY 版不用 `.avif`）；作品页加“摄影” | 网站 |
| 7 | 收尾：删掉旧的独立 Pages 项目；GitHub Pages 关掉或只留跳转页 | — |

## 11. 完成标准

- 首页首屏脚本 gzip 后不超过 130KB（React 19 + React Router 8 本身约 100KB）；4G 网络下最大内容绘制不超过 2 秒。
- 每个工具的 `logic/` 有 Vitest；Playwright 在两个目标上都能打开首页和每个工具、完成主操作，控制台没有报错。
- 两套主题的文字对比度沿用设计系统里已校验的令牌；所有功能都能用键盘完成；尊重“减少动态效果”。
- TOY 包通过 `toy` 脚本的检查：没有会被过滤的文件、没有根路径资源、引入了 SDK、大小在上限内。
