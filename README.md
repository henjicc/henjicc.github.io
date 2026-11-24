# henjihenji.com

痕继痕迹的个人主页：介绍、作品和几个纯前端小工具（水印、随机抽取、批量文本处理）。React + React Router + Vite，网站预渲染成静态页面，由 Cloudflare Pages 构建发布；同一份代码也能打成 B 站 TOY 包。

## 运行

需要 Node 22.22 以上（推荐 24）。

```sh
npm install
npm run dev        # 本地开发
npm run build:web  # 构建网站到 build/client/
npm run check      # 类型检查、ESLint、单元测试
npm run e2e        # 构建后用 Playwright 跑冒烟（需要本机装有 Chrome）
```

## 文档

- [`docs/development-plan.md`](docs/development-plan.md)：开发方案，架构、发布目标和阶段。
- [`rules/project-context.md`](rules/project-context.md)：项目现状、部署和常用命令。
- [`AGENTS.md`](AGENTS.md)：协作规则入口。
