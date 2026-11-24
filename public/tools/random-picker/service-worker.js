// 旧版随机抽取（2024 版）在 /tools/random-picker/ 注册过一个缓存优先的 Service Worker。新站上线后这个地址如果 404，
// 老访客浏览器里的旧 Worker 会一直留着，继续从缓存里返回旧页面。浏览器打开这个范围内的页面时会重新下载 Worker
// 脚本，下载到的是这个文件：它立即接管，清空本站所有缓存，注销自己，再让打开着的页面重新加载成新站。
// 只放在网站构建里（public/ 不进 TOY 包）。至少保留到上线后几个月，等不常来的老访客也都换过来再删。
/* global self, caches */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => undefined)));
    })(),
  );
});
