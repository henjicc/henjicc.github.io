---
template_state: ready
template_version: 27
---

# 项目上下文

> `template_state` 仅取 `pending` 或 `ready`，由初始化流程维护，不在其他文件复制状态。
> `template_version` 是本项目所依据的模板版本（Startwell），业务项目中保持不变，用于日后与模板比对。

## 目标与边界

- 产品：B 站 AI 科技区 UP 主「痕继痕迹」的个人主页 henjihenji.com。它是作品集和工具站的混合体：介绍本人，放视频和其他作品（以后会有摄影等），也是作者自己写的纯前端小工具的家。
- 产品形态：纯静态，没有后端。所有处理都在访客浏览器里完成，不上传用户文件。
- 现状：重构版 2026-11-24 上线，代码全在 `src/`（页面，以及工具 watermark、random-picker、batch-text）。2024 版旧站点的文件已从仓库删除。**做法以 [`docs/development-plan.md`](../docs/development-plan.md) 为准**（2026-11-24 用户确认）。要点：
  - 同一份代码发布到两个目标：网站（henjihenji.com，Cloudflare Pages，全部内容）和 B 站 TOY（只放工具：工具箱合集和单个工具）。两者的差异只放在平台适配层里。
  - 一个仓库、一个域名：主页 `/`，作品 `/works/`（目前只有视频，没有子页面），工具 `/tools/<id>/`，关于 `/about/`。水印工具和批量 LLM 文本处理器的源码已迁进本仓库。
  - 2026-11-24 用户决定：“转个格式”这一轮不迁（`gszh` 保持原样，新站暂时没有入口）；批量文本处理（id `batch-text`）第一版只上网站、不上 TOY，接口密钥默认只放内存，用户自己选记住时才存到设备上；迁入的旧工具不再保留英文界面；水印工具导出时保留原图的 EXIF，包括 GPS（和旧工具一致）。
  - 视频：2026-11-24 用户决定暂时不在网站上显示视频（「暂时不想在网站上显示我的视频」），由站点配置里的视频开关控制；频道数据照常显示。视频数据只在 Cloudflare Pages 构建时拉取，失败用仓库里提交的快照 `src/content/videos.json`。
  - 按“雾林设计系统”重新设计全部页面和工具，视觉完全统一（见下方“设计系统”）。
- 明确不做：常用软件 / 装机清单（2026-11-24 用户决定整体去掉）。
- 已决定、执行中（2026-11-24）：`wmt.henjihenji.com` 用 Cloudflare 重定向规则 301 到 `/tools/watermark/`；确认可用后删除旧的独立 Pages 项目 `watermark-tool` 和 `batch-llm-text-processor`。
- 不在本仓库的作品：“转个格式”是已发布的 B 站 TOY（路径 `gszh`，链接访问），纯前端的文件格式转换工具，源码在作者本机的另一个项目里。

## 设计系统

- 权威来源是 Artifact「雾林设计系统」：https://claude.ai/artifact/K1qBPKMK6HUaknZAes1sMu （私有，只有用户本人能打开）。里面有令牌（两套主题“夜雾 / 晨雾”的颜色、字号、间距、圆角、模糊、时长、缓动）、组件预览与用法、首页桌面版和手机版、工具页外壳、动效规范和“工程落地”。实现时先读它的 README，令牌名照搬。
- 整体效果看 Artifact「雾林全站原型」：https://claude.ai/artifact/3Tg8mR5WxKPVZ9xTdq5GCu （私有）。用设计系统的同一套令牌和组件拼出首页、作品、工具箱和三个工具页，带页面过渡、主题切换、命令面板和手机版首页；实现页面时以它为参照。
- 代码里的 `src/design/tokens.css` 是令牌的唯一数值来源（由设计系统的 tokens.json 生成后改为手工维护）；两边不一致时以代码为准并回头更新设计系统。
- 用户已否决、不要再出现的样式（2026-11-24）：
  - 切角（45° 斜切的角）和直角。所有元素统一用圆角，开关是圆润的轨道配圆形滑块。
  - 带切角造型的数字字体（曾用 Chakra Petch）。全站只用 MiSans，数字开等宽。
- 设计草稿（本机）放 `.local/design/`，不进仓库。

## 按职责指定的库（已安装）

以 [`docs/development-plan.md`](../docs/development-plan.md) 第 2 节的表为准，版本以 `package-lock.json` 为准（全部锁定确切版本）。核心是 React + TypeScript、React Router 8（网站用框架模式预渲染，TOY 用哈希路由）+ Vite、Tailwind CSS v4、shadcn/ui（Radix 底座，组件源码在 `src/ui/`，`components.json` 指向那里）、Lucide、Motion、Zustand、Zod、Vitest、Playwright；命令面板用 cmdk，轻提示用 Sonner，class 合并用 tailwind-merge。2026-11-24 用户同意从 Astro 改为这一套。

- TypeScript 停在 6.0：typescript-eslint 8.74 只支持到 6.1 以下，TypeScript 7 要等它跟上再升。

## 部署与权威入口

- Cloudflare Pages 项目 `henji`（henjicc 这个 Cloudflare 账户）连接本仓库：生产分支 `main`，自动部署；构建命令 `npm run build:web`，输出目录 `build/client`，构建镜像 v3，环境变量 `NODE_VERSION=24`。其他分支自动生成预览地址。域名为 `henjihenji.com`、`www.henjihenji.com`、`henji.pages.dev`，DNS 也托管在这个账户。另一个 Cloudflare 账户里没有本站。上线那次的生产构建日志：Node 24.22.1，拉 B 站视频数据被 412 拦了 5 次后成功。
- GitHub Pages：2026-11-24 作者决定关掉，不再发布本仓库。
- 预览项目：Cloudflare Pages 的 `henji-next`（henjicc 账户），只构建 `rebuild` 分支，`NODE_VERSION=24`，https://henji-next.pages.dev 。`henji` 本身已给每个分支生成预览，这个项目已经多余；删不删由作者决定。
- 视频定时更新：`.github/workflows/update-videos.yml` 每天调一次 Cloudflare Pages 部署钩子，但钩子和仓库 Secret `CF_PAGES_DEPLOY_HOOK` 没建（视频不显示期间用不到），工作流没有 Secret 时只提示、正常退出。
- B 站 TOY：已有“转个格式”（`gszh`）；第 0 阶段的探针“痕迹工具箱测试”（`henji-toy-probe`，密码访问，id 58660860469248）已提交审核。发布用 B 站官方 Toy CLI（`toy create` / `toy update`）。工具箱和单个工具的 TOY 作者决定暂不发布，包用 `npm run toy -- <目标>` 打。`npm run toy` 只打包、检查、生成封面图标，`--preview` / `--publish` 只打印要执行的 CLI 命令，由作者确认后自己运行；每个 TOY 的 id 和路径记在 `toy/<目标>.json`，路径发布后不能改。第 0 阶段的探针包在 `.local/toy-probe/`（不进仓库）。
- 品牌：Logo 是“C”形线框，路径在 `src/ui/logo-path.ts`（取自 `icons/favicon.svg`，也是网站图标）。品牌色是 Logo 渐变里的天蓝，rgb(0,160,234) → rgb(6,182,255)，设计系统里叫 `sky`。
- 社交链接（B 站、YouTube、小红书、抖音）是作者公开的主页地址，属于网站内容。
- 允许提交媒体的目录以 `.githooks/media-allowlist` 为准：`imgs/`（场景照片 `BG01.jpg`，`src/pages/scene.ts` 引用）、`icons/`（网站图标 `favicon.svg`，`src/web/root.tsx` 引用）。

## 已知陷阱

- **推送 `main` 就是上线。** Cloudflare Pages 会自动构建并发布 `main`，所以推送前要用户确认（见下方协作例外）。
- 只有构建产物 `build/client` 会被公开访问，仓库根目录的文件不再直接发布。要随网站发布的静态文件放 `public/`。
- B 站图床（`i*.hdslb.com`）对带第三方 Referer 的请求返回 403，封面和头像的 `<img>` 必须 `referrerpolicy="no-referrer"`（`VideoCard` 已写死）。
- 首页首屏脚本预算 gzip 145KB（开发方案第 11 节），只剩几 KB 余量：大块数据走路由 `loader`，重的代码按需加载。字体的 `@font-face` 规则让全站 CSS 约 450KB（gzip 约 150KB，Cloudflare 的 brotli 更小）。
- 浏览器本地存储按域名隔开。工具从子域名搬到主站后，访客在旧地址存的设置不会带过来。随机抽取在同一域名下，新版第一次打开时经 `platform.storage.legacy` 导入旧版的 `namePickerData` 名单（旧键不动）。
- 旧随机抽取注册过缓存优先的 Service Worker。`public/tools/random-picker/service-worker.js` 是它的自毁版本，只进网站构建；2026-11-24 上线，至少保留几个月再删。
- **TOY 和网站不是同一种运行环境**（依据官方文档，2026-11-24）：页面跑在 `/toy/<路径>/` 下，只能用相对路径；路由用哈希模式（`#/xxx`，官方推荐），分享深链只能带 query；只发布白名单后缀的文件（`.avif`、`.txt`、`.map` 等会被过滤）；当前账号包体上限 140MB。B 站内跳转、存相册、分享、设置记忆都走官方 SDK。所以页面和工具不能直接用 `window.open`、`localStorage`、`location`，统一走平台适配层（见开发方案第 3 节）。TOY 是否和 B 站主站同源还没在 App 里实测，实测前不往 TOY 的本地存储里放任何密钥。
- TOY 在 B 站 App 里实测（2026-11-24）：页面跑在 `www.bilibilitoy.com` 的 iframe 里；SDK 能力全部可用；剪贴板接口被拒；存相册没有系统提示；**手机侧滑返回会直接退出 TOY**，所以 TOY 里页面层级要浅、工具状态要随时保存。详见开发方案第 9 节。
- 本机的 `bili-toy-publisher` 技能有几处已经过时（说不能用 `#` 路由、包体 20MB、命令行脚本连 B 站内部地址）。TOY 的事以官方文档和官方 Toy CLI 为准。
- **TOY 的任何上传都要先经用户同意**，包括只拿预览链接（用户要求，2026-11-24）。每次发布还会生成一条绑定的动态。
- 根目录的 `henjicc.github.io.zip` 是用户自己的备份，未跟踪。不要提交，也不要删除。
- `.trae/` 是以前用 Trae 编辑器留下的笔记，已被忽略。

## 运行与验证

- 先 `npm install`（Node ≥ 22.22；`.node-version` 写的是 24；Cloudflare Pages 用环境变量 `NODE_VERSION=24`）。命令：
  - `npm run dev`：本地开发网站（React Router 开发服务器）。
  - `npm run build:web`：构建网站到 `build/client/`（每个页面预渲染成 HTML，另生成 Cloudflare Pages 用的 `404.html`）；`npm run preview` 在 http://localhost:4173/ 预览构建结果。只有 Cloudflare Pages 上（`CF_PAGES=1`）会先拉取视频数据，本地构建不改快照。
  - `npm run videos`：手动拉取最新视频数据覆盖 `src/content/videos.json`，看过 diff 再提交。
  - `npm run toy -- <toolbox | 工具 id>`：打 TOY 包到 `dist-toy/<目标>/` 并检查，封面和图标在 `dist-toy/<目标>-assets/`。从不上传。
  - `npm run check`：路由类型生成 + `tsc` + ESLint + Vitest。
  - `npm run e2e`：先构建网站和 TOY 工具箱，再用 Playwright 跑冒烟（网站桌面和手机、TOY 包挂在本地 `/toy/test/`）。浏览器用本机装的 Chrome。每次自己在 4173 / 4317 起服务、不复用已有的，端口被占时直接报错；并行的工作树用 `E2E_WEB_PORT` / `E2E_TOY_PORT` 换端口。
- 最低验证：改了代码跑 `npm run check`；改了页面、外壳或工具再跑 `npm run e2e`，并在浏览器里看一遍受影响的页面（两套主题、桌面和手机宽度）。推送 `main` 后（用户确认之后）等 Cloudflare 构建完，打开 https://www.henjihenji.com/ 核对内容。

## 协作例外

- AI 规则入口只有 `AGENTS.md`，不建 `CLAUDE.md`（用户要求，2026-11-24）。
- 提交照 Git 规则主动做；推送 `main` 会自动部署上线，所以每次推送前都要用户确认。这条覆盖 `git-workflow.md` 里“主动推送当前上游”的默认授权。
- 私人内容门禁的本机路径和保密词条还没登记（用户尚未提供）；得知时登记进 `.git/config`。
