// TOY 入口：哈希路由挂同一批页面组件（官方推荐哈希路由：跳转都在 index.html 内完成，刷新不 404，后退可用）。
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, Navigate, Outlet, ScrollRestoration, useParams } from "react-router";
import { RouterProvider } from "react-router/dom";
import "~/design/global.css";
import { ToolPage } from "~/pages/ToolPage";
import { ToyHomePage } from "~/pages/ToyHomePage";
import { AppShell } from "~/shell/AppShell";
import { singleToolId } from "~/shell/env";
import type { ShellHandle } from "~/shell/handle";
import { getLiveTool } from "~/tools/lookup";

// 分享和二维码只能带 query、不能带 #，所以深链写成 index.html?p=/tools/xxx，启动时转成哈希路由。
const deepLink = new URLSearchParams(location.search).get("p");
if (deepLink?.startsWith("/") && !location.hash) location.replace(`${location.pathname}${location.search}#${deepLink}`);

function Root() {
  return (
    <AppShell>
      <Outlet />
      <ScrollRestoration />
    </AppShell>
  );
}

function ToolRoute() {
  const tool = getLiveTool(useParams().id);
  return tool ? <ToolPage tool={tool} /> : <Navigate to="/" replace />;
}

const singleTool = singleToolId ? getLiveTool(singleToolId) : undefined;

const toolHandle: ShellHandle = { tool: true };

// TOY 里页面层级最多“列表 → 工具”一层：手机侧滑返回会直接退出整个 TOY，不走页面内的历史。
const children = singleToolId
  ? [
      { index: true, element: singleTool ? <ToolPage tool={singleTool} /> : null, handle: toolHandle },
      { path: "*", element: <Navigate to="/" replace /> },
    ]
  : [
      { index: true, element: <ToyHomePage /> },
      { path: "tools/:id", element: <ToolRoute />, handle: toolHandle },
      { path: "*", element: <Navigate to="/" replace /> },
    ];

const router = createHashRouter([{ element: <Root />, children }]);

const container = document.getElementById("root");
if (!container) throw new Error("index.html 里缺少 #root");
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
