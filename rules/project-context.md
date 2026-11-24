---
template_state: pending
template_version: 27
---

# 项目上下文

> `template_state` 仅取 `pending` 或 `ready`，由初始化流程维护，不在其他文件复制状态。
> `template_version` 是本项目所依据的模板版本（Startwell），业务项目中保持不变，用于日后与模板比对。

## 目标与边界

- 产品：B 站 AI 科技区 UP 主「痕继痕迹」的个人主页 henjihenji.com，加上作者自己写的一些纯前端小工具。访客多是观众，来这里找关注入口、用小工具、看推荐的软件。
- 产品形态：纯静态网站，没有后端。所有处理都在访客浏览器里完成，不上传用户文件。
- 已批准的计划（2026-11-24 用户要求）：整体重构。界面重新设计，功能补全，小工具不再各占一个子域名，统一放到主站下。技术栈、工具怎么并入、选哪个设计方向还没定，见文末“初始化待解决事项”。重构定案前，现有页面只做必要修补。
- 现状（2026-11 核实）：
  - 主页（2024 版）：`index.html` + `styles.css` + `script.js`，常用软件数据在 `js/software-data.js`。一张毛玻璃卡片，点按钮打开三个弹窗：小工具、常用软件、关注一下。
  - 随机抽取：`tools/random-picker/`，原生 JS，带 PWA（`manifest.json`、`service-worker.js`），在本仓库里。
  - 水印工具：独立仓库 `henjicc/watermark-tool`（Vite + React + Tailwind），部署在单独的 Cloudflare Pages 项目 `watermark-tool`，绑定 `wmt.henjihenji.com`。主页的入口直接跳到这个子域名。
  - 批量 LLM 文本处理器：私有仓库 `henjicc/Batch-LLM-Text-Processor`（Vite + React + Zustand），在单独的 Pages 项目 `batch-llm-text-processor`，主页上没有入口。

## 部署与权威入口

- Cloudflare Pages 项目 `henji`（henjicc 这个 Cloudflare 账户）连接本仓库：生产分支 `main`，自动部署；构建命令为空，输出就是仓库根目录。域名为 `henjihenji.com`、`www.henjihenji.com`、`henji.pages.dev`，DNS 也托管在这个账户。另一个 Cloudflare 账户里没有本站。
- GitHub Pages（`henjicc.github.io`）也直接发布仓库根目录，和 Cloudflare 是同一份内容。
- 品牌：Logo 是 `index.html` 里内联的 SVG（“C”形线框），`icons/favicon.svg` 是网站图标。品牌色是 Logo 渐变里的天蓝，rgb(0,160,234) → rgb(6,182,255)。
- 社交链接（B 站、YouTube、小红书、抖音）写在 `index.html` 的“关注我”弹窗里；这些是作者公开的主页地址，属于网站内容。
- 允许提交媒体的目录以 `.githooks/media-allowlist` 为准：`imgs/`（主页背景图）、`icons/`（网站图标）、`tools/*/icons/`（工具图标）。
- 设计稿目录：`.local/design/`，不进仓库。

## 已知陷阱

- **推送 `main` 就是上线。** Cloudflare Pages 和 GitHub Pages 都会自动发布 `main`，所以推送前要用户确认（见下方协作例外）。
- **仓库根目录下的已跟踪文件都能被公开访问**，因为 Pages 直接发布根目录。`AGENTS.md`、`rules/`、`.githooks/` 也会被访问到。仓库本来就是公开的，所以不算泄漏，但别往根目录放不想公开的东西。重构引入构建步骤后改为只发布构建产物。
- 工具链接要写成目录路径（`./tools/random-picker/`）。2025-12 写成 `.../index.html` 时线上打不开，改成目录路径后正常。
- `package.json` 的 `build` 脚本指向已经删掉的 `tools/watermark-tool` 子模块，跑不起来。Pages 的构建命令为空，所以线上不受影响。重构时替换掉。
- 根目录的 `henjicc.github.io.zip` 是用户自己的备份，未跟踪。不要提交，也不要删除。
- `.trae/` 是以前用 Trae 编辑器留下的笔记，已被忽略。

## 运行与验证

- 目前没有依赖、构建和自动化测试。本地预览：在仓库根目录起一个静态文件服务器打开；工具页的 service worker 要通过 http(s) 才会注册，直接双击文件看不到。
- 最低验证：在浏览器里打开改到的页面，控制台无报错，点一遍受影响的入口和弹窗。上线后（用户确认推送之后）打开 https://www.henjihenji.com/ 核对内容。

## 协作例外

- AI 规则入口只有 `AGENTS.md`，不建 `CLAUDE.md`（用户要求，2026-11-24）。
- 提交照 Git 规则主动做；推送 `main` 会自动部署上线，所以每次推送前都要用户确认。这条覆盖 `git-workflow.md` 里“主动推送当前上游”的默认授权。

## 初始化待解决事项

规则已按模板接入，但重构方案还没定，所以状态保持 `pending`。等用户确认以下几项后写进上文，再改为 `ready`：

1. 重构技术栈。当前建议：Astro 做站点骨架（主页和内容页输出静态 HTML），工具页用 React 组件嵌入；样式 Tailwind CSS，组件 shadcn/ui，图标 Lucide，动画 Motion。选型理由和其他方案见设计稿页面的说明。
2. 工具怎么并入：建议把水印工具、批量 LLM 文本处理器的源码迁进本仓库，统一放到 `henjihenji.com/tools/<工具名>/`，旧子域名用 Cloudflare 重定向规则 301 到新地址，然后停掉对应的独立 Pages 项目。
3. 设计方向：在设计稿的方案 A 和方案 B 里选一个或混合。
4. GitHub Pages：是否保留。改成要构建之后，它不会自动发布构建产物；建议关掉，或者只留一个跳转到 henjihenji.com 的页面。
5. 私人内容防线：请用户提供需要登记的本机路径和保密词条（素材盘、数据目录、不想公开的名字等），登记进 `.git/config`。
