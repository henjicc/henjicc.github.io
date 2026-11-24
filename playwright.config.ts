import { defineConfig, devices } from "@playwright/test";

// 冒烟测试：网站的构建结果和 TOY 包各跑一遍（npm run e2e 会先构建两边）。
// 浏览器用本机装的 Chrome（channel: "chrome"），不另外下载 Playwright 的浏览器。
const WEB = "http://localhost:4173";
const TOY = "http://localhost:4317/toy/test/";

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
    { command: "node scripts/serve.ts build/client --port 4173", url: `${WEB}/`, reuseExistingServer: !process.env.CI },
    { command: "node scripts/serve.ts dist-toy/toolbox --base toy/test --port 4317", url: `${TOY}index.html`, reuseExistingServer: !process.env.CI },
  ],
});
