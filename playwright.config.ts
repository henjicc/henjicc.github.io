import { defineConfig, devices } from "@playwright/test";

// 冒烟测试：网站的构建结果和 TOY 包各跑一遍（npm run e2e 会先构建两边）。
// 浏览器用本机装的 Chrome（channel: "chrome"），不另外下载 Playwright 的浏览器。
// 每次都自己起服务、不复用端口上已有的：并行的工作树复用了别人的服务，测到的就是别人的构建。
// 端口冲突时 Playwright 会直接报错；同时跑多份时用 E2E_WEB_PORT / E2E_TOY_PORT 换端口。
const WEB_PORT = process.env.E2E_WEB_PORT ?? "4173";
const TOY_PORT = process.env.E2E_TOY_PORT ?? "4317";
const WEB = `http://localhost:${WEB_PORT}`;
const TOY = `http://localhost:${TOY_PORT}/toy/test/`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: { channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "web", testMatch: /web\.spec\.ts/, use: { ...devices["Desktop Chrome"], channel: "chrome", baseURL: WEB } },
    {
      name: "web-mobile",
      testMatch: /web\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chrome", baseURL: WEB },
    },
    // B 站 App 里实测的可用区域是 400 × 713
    {
      name: "toy",
      testMatch: /toy\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 400, height: 713 }, baseURL: TOY },
    },
  ],
  webServer: [
    { command: `node scripts/serve.ts build/client --port ${WEB_PORT}`, url: `${WEB}/`, reuseExistingServer: false },
    { command: `node scripts/serve.ts dist-toy/toolbox --base toy/test --port ${TOY_PORT}`, url: `${TOY}index.html`, reuseExistingServer: false },
  ],
});
