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
- 已批准的计划（2026-11-24 用户确认），尚未开工。**做法以 [`docs/development-plan.md`](../docs/development-plan.md) 为准**，要点：
  - 同一份代码发布到两个目标：网站（henjihenji.com，Cloudflare Pages，全部内容）和 B 站 TOY（只放工具：工具箱合集和单个工具）。两者的差异只放在平台适配层里。
  - 一个仓库、一个域名：主页 `/`，作品 `/works/`，工具 `/tools/<id>/`，关于 `/about/`。水印工具和批量 LLM 文本处理器的源码迁进本仓库；`wmt.henjihenji.com` 用 Cloudflare 重定向规则 301 到新地址，确认可用后再删除对应的独立 Pages 项目。
  - 按“雾林设计系统”重新设计全部页面和工具，视觉完全统一（见下方“设计系统”）。
  - 分阶段上线，第 0 阶段先在 TOY 上验证几件文档里确认不了的事。
- 明确不做：常用软件 / 装机清单（2026-11-24 用户决定整体去掉，重构后不再保留现在主页的“常用软件”弹窗）。
- 还没定、但不阻塞的事：GitHub Pages 是关掉还是只放一个跳转页（迁移最后一步再定）。
- 现状（2026-11 核实）：
  - 主页（2024 版）：`index.html` + `styles.css` + `script.js`，常用软件数据在 `js/software-data.js`。一张毛玻璃卡片，点按钮打开三个弹窗：小工具、常用软件、关注一下。
  - 随机抽取：`tools/random-picker/`，原生 JS，带 PWA（`manifest.json`、`service-worker.js`），在本仓库里。
  - 水印工具：独立仓库 `henjicc/watermark-tool`（Vite + React + Tailwind），部署在单独的 Cloudflare Pages 项目 `watermark-tool`，绑定 `wmt.henjihenji.com`。主页的入口直接跳到这个子域名。
  - 批量 LLM 文本处理器：私有仓库 `henjicc/Batch-LLM-Text-Processor`（Vite + React + Zustand），在单独的 Pages 项目 `batch-llm-text-processor`，主页上没有入口。

## 设计系统

- 权威来源是 Artifact「雾林设计系统」：https://claude.ai/artifact/K1qBPKMK6HUaknZAes1sMu （私有，只有用户本人能打开）。里面有令牌（两套主题“夜雾 / 晨雾”的颜色、字号、间距、圆角、模糊、时长、缓动）、组件预览与用法、首页桌面版和手机版、工具页外壳、动效规范和“工程落地”。实现时先读它的 README，令牌名照搬。
- 整体效果看 Artifact「雾林全站原型」：https://claude.ai/artifact/3Tg8mR5WxKPVZ9xTdq5GCu （私有）。用设计系统的同一套令牌和组件拼出首页、作品、工具箱和三个工具页，带页面过渡、主题切换、命令面板和手机版首页；实现页面时以它为参照。
- 实现后，代码里的 `src/styles/tokens.css` 是令牌的唯一数值来源；两边不一致时以代码为准并回头更新设计系统。
- 用户已否决、不要再出现的样式（2026-11-24）：
  - 切角（45° 斜切的角）和直角。所有元素统一用圆角，开关是圆润的轨道配圆形滑块。
  - 带切角造型的数字字体（曾用 Chakra Petch）。全站只用 MiSans，数字开等宽。
- 设计草稿（本机）放 `.local/design/`，不进仓库。

## 按职责指定的库（已批准，尚未安装）

以 [`docs/development-plan.md`](../docs/development-plan.md) 第 2 节的表为准，版本以将来的锁文件为准。核心是 React + TypeScript、React Router 7（框架模式，网站预渲染、TOY 用内存路由）+ Vite、Tailwind CSS v4、shadcn/ui、Lucide、Motion、Zustand、Zod、Vitest、Playwright。2026-11-24 用户同意从 Astro 改为这一套。

## 部署与权威入口

- Cloudflare Pages 项目 `henji`（henjicc 这个 Cloudflare 账户）连接本仓库：生产分支 `main`，自动部署；构建命令为空，输出就是仓库根目录。域名为 `henjihenji.com`、`www.henjihenji.com`、`henji.pages.dev`，DNS 也托管在这个账户。另一个 Cloudflare 账户里没有本站。重构上线时把构建命令改为 `npm run build:web`、输出目录改为 `build/client`。
- GitHub Pages（`henjicc.github.io`）也直接发布仓库根目录，和 Cloudflare 是同一份内容。
- B 站 TOY：还没有发布过。发布一律走 `bili-toy-publisher` 技能（先预览、用户确认后再创建或更新，每次都要过审核）；每个 TOY 的 id 和路径记在 `toy/<目标>/toy.yaml`，路径发布后不能改。
- 品牌：Logo 是 `index.html` 里内联的 SVG（“C”形线框），`icons/favicon.svg` 是网站图标。品牌色是 Logo 渐变里的天蓝，rgb(0,160,234) → rgb(6,182,255)，设计系统里叫 `sky`。
- 社交链接（B 站、YouTube、小红书、抖音）写在 `index.html` 的“关注我”弹窗里；这些是作者公开的主页地址，属于网站内容。
- 允许提交媒体的目录以 `.githooks/media-allowlist` 为准：`imgs/`（主页背景图，也是设计系统里的场景照片）、`icons/`（网站图标）、`tools/*/icons/`（工具图标）。

## 已知陷阱

- **推送 `main` 就是上线。** Cloudflare Pages 和 GitHub Pages 都会自动发布 `main`，所以推送前要用户确认（见下方协作例外）。
- **仓库根目录下的已跟踪文件都能被公开访问**，因为 Pages 直接发布根目录。`AGENTS.md`、`rules/`、`.githooks/` 也会被访问到。仓库本来就是公开的，所以不算泄漏，但别往根目录放不想公开的东西。重构引入构建步骤后改为只发布构建产物。
- 工具链接要写成目录路径（`./tools/random-picker/`）。2025-12 写成 `.../index.html` 时线上打不开，改成目录路径后正常。
- `package.json` 的 `build` 脚本指向已经删掉的 `tools/watermark-tool` 子模块，跑不起来。Pages 的构建命令为空，所以线上不受影响。重构时替换掉。
- 浏览器本地存储按域名隔开。工具从子域名搬到主站后，访客在旧地址存的设置不会带过来。
- **TOY 和网站不是同一种运行环境**：页面跑在 `/toy/<路径>/` 下，只能用相对路径；不支持 `#` 跳转，也不能用 `pushState` 改地址；直接写的外部链接会被平台改写坏；包体建议在 20MB 以内。所以页面和工具不能直接用 `window.open`、`localStorage`、`location`，统一走平台适配层（见开发方案第 3 节）。TOY 是否和 B 站主站同源、能否请求第三方接口还没验证，验证前不往 TOY 的本地存储里放任何密钥。
- 根目录的 `henjicc.github.io.zip` 是用户自己的备份，未跟踪。不要提交，也不要删除。
- `.trae/` 是以前用 Trae 编辑器留下的笔记，已被忽略。

## 运行与验证

- 目前没有依赖、构建和自动化测试。本地预览：在仓库根目录起一个静态文件服务器打开；工具页的 service worker 要通过 http(s) 才会注册，直接双击文件看不到。重构后改为 `npm run dev` / `npm run build`，届时更新这里。
- 最低验证：在浏览器里打开改到的页面，控制台无报错，点一遍受影响的入口。上线后（用户确认推送之后）打开 https://www.henjihenji.com/ 核对内容。

## 协作例外

- AI 规则入口只有 `AGENTS.md`，不建 `CLAUDE.md`（用户要求，2026-11-24）。
- 提交照 Git 规则主动做；推送 `main` 会自动部署上线，所以每次推送前都要用户确认。这条覆盖 `git-workflow.md` 里“主动推送当前上游”的默认授权。
- 私人内容门禁的本机路径和保密词条还没登记（用户尚未提供）；得知时登记进 `.git/config`。
