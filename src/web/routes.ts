import { index, route, type RouteConfig } from "@react-router/dev/routes";

// 工具页是一条动态路由，预渲染哪些工具由 react-router.config.ts 按工具登记表列出。
export default [
  index("routes/home.tsx"),
  route("works", "routes/works.tsx"),
  route("tools", "routes/tools.tsx"),
  route("tools/:id", "routes/tool.tsx"),
  route("about", "routes/about.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
