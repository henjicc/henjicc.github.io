import type { ReactNode } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "~/design/global.css";
import { NotFoundPage } from "~/pages/NotFoundPage";
import { AppShell } from "~/shell/AppShell";
import { themeBootScript } from "~/shell/theme-boot";
import favicon from "../../icons/favicon.svg?url";
import type { Route } from "./+types/root";

export const links: Route.LinksFunction = () => [{ rel: "icon", type: "image/svg+xml", href: favicon }];

export function Layout({ children }: { children: ReactNode }) {
  return (
    // 启动脚本在水合前就会给 html 写上 data-theme
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <main className="wrap grid min-h-dvh content-center gap-3">
      <h1 className="m-0 text-title-2">页面出错了</h1>
      <p className="m-0 text-body text-ink-muted">刷新一下试试，还不行就回首页。</p>
    </main>
  );
}
