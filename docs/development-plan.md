# henjihenji.com 重构开发方案

> 状态：已定方案，尚未开工。
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

每个职责只用一个库。版本以锁文件为准，开工时核对一次最新稳定版。

| 职责 | 选用 | 说明 |
|---|---|---|
| 界面 | React + TypeScript | 生态最全：下面几项都是 React 原生的 |
| 路由与构建 | React Router 7（框架模式）+ Vite | 网站：`ssr: false` + `prerender: true`，每个页面构建时输出静态 HTML，不需要服务器。TOY：同一批页面组件，用内存路由打成单个 `index.html` |
| 样式 | Tailwind CSS v4 | 用 `@theme` 映射雾林令牌 |
| 基础组件 | shadcn/ui | 源码进项目，按雾林样式改；命令面板用它的 Command（cmdk），轻提示用 Sonner |
| 图标 | Lucide | |
| 动画 | Motion（`motion/react`） | 组件内动效；页面过渡用 View Transitions |
| 工具内状态 | Zustand | 每个工具一个 store；持久化走平台适配层，不直接写 localStorage |
| 数据校验 | Zod | 内容数据（视频、摄影、工具登记）在构建时校验 |
| 字体 | MiSans 网页字体（按字切片、自托管） | 页脚注明“字体：MiSans”，这是许可要求 |
| 测试 | Vitest + Playwright | 纯逻辑用 Vitest；两个发布目标各跑一遍 Playwright 冒烟 |
| 代码检查 | TypeScript 严格模式 + ESLint | ESLint 禁止页面和工具直接用 `window.open`、`localStorage`、`location`，必须走平台适配层 |

为什么不用 Astro：这个站的主体是工具和贯穿全站的交互（Ctrl K、主题、轻提示、常驻顶栏、共享元素过渡），整站一个 React 应用最顺。TOY 只接受单个 `index.html` 加页面内跳转，多页面架构在 TOY 上反而难做。

## 3. 两个发布目标的差异

| | 网站 | TOY |
|---|---|---|
| 路由 | 浏览器地址（`/tools/watermark/`），每页预渲染 | 内存路由：不改地址栏，不用 `#`，不用 `pushState` |
| 资源路径 | 根路径 `/` | 相对路径（Vite `base: "./"`），页面跑在 `/toy/<路径>/` 下 |
| 外部链接 | 普通 `<a target="_blank">` | 平台会改写直接写的外部链接，统一用脚本打开 |
| 保存文件 | 浏览器下载 | 用 SDK 存到相册；没有 SDK 时显示图片，长按保存 |
| 设置记忆 | localStorage（按工具加前缀） | SDK 云存档；拿不到时只存在内存里 |
| 返回 | 浏览器后退 | 页面内顶栏的返回按钮（App 的返回键行为待验证） |
| 数据 | 构建时拉取的视频数据 | 打进包里的快照；TOY 版基本用不到视频数据 |
| 更新 | 推送 `main` 自动部署 | 每次都要构建、预览、你确认，再提交审核 |
| 体积 | 不紧张 | ZIP 建议在 20MB 以内，字体切片要算进去 |

这些差异全部收进一个**平台适配层**（`src/platform/`）。页面和工具只调用它，不判断自己在哪个平台：

```ts
export interface Platform {
  kind: "web" | "toy";
  openExternal(url: string): void;
  saveImage(blob: Blob, filename: string): Promise<"saved" | "shown">;
  storage: {                        // 按工具分命名空间，值都是 JSON
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
  };
  share?(payload: { title: string; image?: Blob; url?: string }): Promise<void>;
  viewer?(): Promise<{ following: boolean } | null>;   // 只在 TOY 上有：关注状态
}
```

## 4. 信息结构

| 网站地址 | 页面 | TOY 里有没有 |
|---|---|---|
| `/` | 首页：我是谁、最新视频、小工具、作品精选、关注方式 | 工具箱合集的首页换成“工具列表 + 一句介绍 + 关注” |
| `/works/` | 作品：视频、摄影、其他，按类别切换 | 不放 |
| `/works/videos/` | 全部视频 | 不放 |
| `/works/photos/` | 摄影（第 6 阶段） | 视验证结果决定 |
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
    entry.tsx             TOY 入口：内存路由，挂同一批页面
  shell/                  全站外壳：顶栏、页脚、命令面板、主题切换、轻提示、过渡
  design/
    tokens.css            雾林令牌，唯一的数值来源
    global.css            Tailwind 入口与基础样式
  ui/                     shadcn 组件（改成雾林样式）与雾林自有组件
  platform/               平台适配层：web.ts、toy.ts、index.ts
  pages/                  首页、作品、工具箱、关于（只组合 shell、ui 和内容数据）
  content/
    schema.ts             Zod 结构
    videos.json           构建时生成；拉取失败沿用上一次
    photos/               摄影数据（第 6 阶段）
  tools/
    registry.ts           工具登记：id、名称、图标、状态、关键词、能否上 TOY
    watermark/
      meta.ts
      Tool.tsx            界面：只用 ui/、shell/ 的工具外壳组件和 platform/
      logic/              纯函数：不碰 React 和 DOM，Vitest 测
      store.ts
    random-picker/
    text-batch/
scripts/
  fetch-videos.ts         拉取 B 站视频数据
  build-toy.ts            按目标打 TOY 包并跑 TOY 检查
toy/
  toolbox/toy.yaml        工具箱合集的 TOY 记录（id、路径、地址）
  watermark/toy.yaml      单个工具的 TOY 记录
```

依赖方向只能往下：`pages`、`tools` → `shell`、`ui`、`platform`、`content` → `design`。几条硬规矩：

- 工具之间互不引用。删掉一个工具目录、去掉登记表里的一行，两个目标都照常构建。
- 首页、工具箱、命令面板、路由和 TOY 打包都从 `tools/registry.ts` 读工具列表。
- 颜色、间距、圆角、时长只从令牌取，业务代码里不写十六进制颜色和魔法数字。
- 页面和工具不直接碰 `window.open`、`localStorage`、`location`，由 ESLint 拦。

## 6. 页面过渡与动效

- 网站：页面切换用 View Transitions（React Router 的 `viewTransition` 导航，或 React 自带的 `ViewTransition` 组件，开工时按当时的推荐做法选一个）。工具卡片的图标块和工具名用 `tool-<id>-icon`、`tool-<id>-name` 做共享元素。
- TOY：内存路由切换时同样包一层 `document.startViewTransition`，不支持时直接切换。
- 主题切换的圆形扩散、雾散入场、按压反馈等，全部按设计系统「动效」一节，原型里已经实现过一遍，可以直接参考。

## 7. 手机优先的工具布局

TOY 的访客几乎都在手机上，所以每个工具都要先有手机布局，再有桌面布局：

- 舞台（预览区）占上半屏；控制栏是底部抽屉，有收起和展开两档；主按钮固定在最底下。
- 文件从相册选、拍照或粘贴进来；导出走平台适配层的 `saveImage`。
- 这一版设计系统只画了手机首页，**第 3 阶段开工前要先补画手机版工具外壳**。

## 8. 构建与发布

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发网站 |
| `npm run build:web` | 构建网站，输出 `build/client/`（Cloudflare Pages 的输出目录） |
| `npm run build:toy -- toolbox` | 打工具箱合集的 TOY 包，输出 `dist-toy/toolbox/` |
| `npm run build:toy -- watermark` | 打单个工具的 TOY 包 |
| `npm run check` | 类型检查、ESLint、Vitest |
| `npm run e2e` | Playwright：网站跑一遍；TOY 包放在本地的 `/toy/test/` 路径下再跑一遍，专门抓资源路径写错的问题 |

发布：

- **网站**：推送 `main` 后由 Cloudflare Pages 自动构建上线。推送就是上线，所以每次推送前先找你确认。其他分支自动生成预览地址，大改动先在预览上看。
- **TOY**：本地打包 → 跑 `bili-toy-publisher` 技能的 TOY 检查 → 生成预览链接给你看 → 你确认后创建或更新 → 等审核。`toy/<目标>/toy.yaml` 记住项目 id，保证更新不换地址。TOY 的路径发布后不能改，第一次起名要定好。

## 9. 先验证，再动手

TOY 有几件事从文档里确认不了，影响后面的设计，第 0 阶段先发一个只生成预览、不公开的最小 TOY 测出来：

1. 页面是不是直接跑在 `www.bilibili.com` 这个源下。如果是，本地存储和所有 TOY、甚至 B 站主站共用，**任何密钥都不能存进去**（直接影响批量文本处理）。
2. 能不能请求第三方接口（大模型接口、字体和图片的 CDN）。
3. SDK 的具体接口：存相册、云存档、关注状态、分享。开发者文档页需要开通发布权限才能看，需要你登录后打开，或者把文档内容给我。
4. 内存路由下，App 的返回键是退出 TOY 还是能拦截。
5. 字体切片和工具代码打包后，体积离 20MB 有多远。

## 10. 阶段

每个阶段做完都能单独上线，旧地址在最后一步之前一直可用。

| 阶段 | 内容 | 上线 |
|---|---|---|
| 0 | TOY 验证（上面 5 件事）；补画手机版工具外壳 | 只出 TOY 预览 |
| 1 | 项目骨架：两个构建目标、令牌、ui 组件、shell、平台适配层、检查与冒烟测试；Cloudflare 构建设置改为 `npm run build:web` / `build/client` | 网站预览分支 |
| 2 | 首页、作品（视频，构建时拉取）、关于；替换现在的首页 | 网站 |
| 3 | 工具外壳（桌面 + 手机）和随机抽取（最简单，先跑通整条链路） | 网站 + 第一个 TOY |
| 4 | 迁入水印工具；TOY 版接 SDK 存相册；`wmt.henjihenji.com` 301 到新地址 | 网站 + TOY |
| 5 | 迁入批量文本处理；TOY 版做不做、怎么存接口密钥，按第 0 阶段的结果定 | 网站（TOY 待定） |
| 6 | 摄影作品：图片放 Cloudflare R2，上传时生成多尺寸；作品页加“摄影” | 网站 |
| 7 | 收尾：删掉旧的独立 Pages 项目；GitHub Pages 关掉或只留跳转页 | — |

## 11. 完成标准

- 首页脚本（含 React）在 gzip 后控制在 100KB 以内；4G 网络下最大内容绘制不超过 2 秒。
- 每个工具的 `logic/` 有 Vitest；Playwright 在两个目标上都能打开首页和每个工具、完成主操作，控制台没有报错。
- 两套主题的文字对比度沿用设计系统里已校验的令牌；所有功能都能用键盘完成；尊重“减少动态效果”。
- TOY 包通过 `bili-toy-publisher` 的检查：没有根路径资源、没有 `#` 跳转、外部链接都走脚本。
