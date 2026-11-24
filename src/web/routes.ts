import { index, route, type RouteConfig } from "@react-router/dev/routes";

// 工具页是一条通配路由，预渲染哪些工具由 react-router.config.ts 按工具登记表列出。
// 写成 tools/* 而不是 tools/:id：Pages 对 /tools/ 下任何找不到的地址（包括 /tools/x/y/ 这种更深的）都返回 tools/404.html，
// 它由这条路由预渲染；浏览器里这些地址也都要匹配到同一条路由，否则水合时对不上，页面会被渲染两遍。
export default [
  index("routes/home.tsx"),
  route("works", "routes/works.tsx"),
  route("tools", "routes/tools.tsx"),
  route("tools/*", "routes/tool.tsx"),
  route("about", "routes/about.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
