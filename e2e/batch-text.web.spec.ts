import { readFile } from "node:fs/promises";
import type { Page, Route } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { expect, test } from "./fixtures";

// 接口全部用 Playwright 拦下来假装回复，不会有请求真的发出去。地址和密钥都是编的。
const BASE = "https://llm.example.test/v1";
const KEY = "sk-fictional-e2e-0000";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

type ChatBody = { model: string; messages: { role: string; content: string }[] };

/** 预检请求直接放行；其他请求交给 handler。返回收到的对话请求体。 */
async function mockLlm(page: Page, handler: (route: Route, body: ChatBody) => void | Promise<void>) {
  const bodies: ChatBody[] = [];
  await page.route(`${BASE}/**`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = route.request().postDataJSON() as ChatBody;
    bodies.push(body);
    await handler(route, body);
  });
  return bodies;
}

function reply(route: Route, content: string) {
  return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content } }] }) });
}

/** 手机布局的设置在底部抽屉里，先展开。 */
async function openSettings(page: Page) {
  // 等设置从存储里读完、界面可用
  await expect(page.getByRole("button", { name: "开始处理" })).toBeEnabled();
  if ((page.viewportSize()?.width ?? 1280) >= 768) return;
  await page.locator("button[aria-expanded='false']").filter({ hasText: "设置" }).click();
  await expect(page.locator("button[aria-expanded='true']").filter({ hasText: "收起" })).toBeVisible();
}

/** from：先打开这一页，再点站内链接进工具，留下一条站内历史。 */
async function setUp(page: Page, { concurrency = 1, from = "" } = {}) {
  if (from) {
    await page.goto(from);
    await page.locator("a[href='/tools/batch-text/']").first().click();
    await expect(page).toHaveURL(/\/tools\/batch-text\/$/);
  } else {
    await page.goto("/tools/batch-text/");
  }
  await openSettings(page);
  await page.getByRole("button", { name: "管理接口" }).click();
  const dialog = page.getByRole("dialog", { name: "接口配置" });
  await dialog.getByRole("button", { name: "编辑 默认配置" }).click();
  await dialog.getByLabel("接口地址", { exact: true }).fill(BASE);
  await dialog.getByLabel("模型", { exact: true }).fill("demo-model");
  await dialog.getByRole("button", { name: "保存" }).click();
  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("接口密钥").fill(KEY);
  const slider = page.getByRole("slider", { name: "同时处理" });
  for (let i = 1; i < concurrency; i++) await slider.press("ArrowRight");
}

async function addFiles(page: Page, texts: string[]) {
  await page
    .locator("input[type='file'][accept*='.md']")
    .first()
    .setInputFiles(texts.map((text, i) => ({ name: `示例${i + 1}.txt`, mimeType: "text/plain", buffer: Buffer.from(text) })));
  await expect(page.getByRole("list", { name: "文件" }).getByRole("listitem")).toHaveCount(texts.length);
}

async function storedValues(page: Page): Promise<string> {
  return page.evaluate(() => Object.keys(window.localStorage).map((k) => `${k}=${window.localStorage.getItem(k)}`).join("\n"));
}

test("跑一小批：每个文件发一次请求，内容原样填进提示词", async ({ page }) => {
  const bodies = await mockLlm(page, (route, body) => reply(route, `结果：${body.messages.at(-1)?.content.length}`));
  await setUp(page);
  const texts = ["林间的雾慢慢散开。", "价格写成 $& 和 $' 也不会被改。", "第三段虚构的文字。"];
  await addFiles(page, texts);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(page.getByRole("list", { name: "文件" }).getByText("完成", { exact: true })).toHaveCount(3);
  expect(bodies).toHaveLength(3);
  expect(bodies.every((b) => b.model === "demo-model")).toBe(true);
  const sent = bodies.map((b) => b.messages.at(-1)?.content ?? "");
  for (const text of texts) expect(sent.some((s) => s.endsWith(text))).toBe(true);
});

test("停止会取消正在发的请求，之后不再发新的", async ({ page }) => {
  // 对话请求一直不回，模拟模型在慢慢生成
  const bodies = await mockLlm(page, () => new Promise<void>(() => {}));
  const aborted: string[] = [];
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(BASE) && r.method() === "POST") aborted.push(r.failure()?.errorText ?? "");
  });
  await setUp(page, { concurrency: 2 });
  await addFiles(page, ["一", "二", "三", "四"]);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  await page.getByRole("button", { name: "停止" }).click();
  await expect.poll(() => aborted.length).toBe(2);
  expect(aborted.every((e) => e.includes("ABORTED"))).toBe(true);
  await expect(page.getByRole("list", { name: "文件" }).getByText("待处理", { exact: true })).toHaveCount(4);
  await page.waitForTimeout(800);
  expect(bodies).toHaveLength(2);
});

test("选中结果后导出 ZIP", async ({ page }) => {
  await mockLlm(page, (route) => reply(route, "改写后的虚构文字"));
  await setUp(page);
  await addFiles(page, ["甲", "乙"]);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(page.getByRole("list", { name: "文件" }).getByText("完成", { exact: true })).toHaveCount(2);
  await page.getByLabel("全选").check();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /下载结果/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^处理结果_.+\.zip$/);
  const entries = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(entries).sort()).toEqual(["示例1_processed.txt", "示例2_processed.txt"]);
  expect(strFromU8(entries["示例1_processed.txt"]!)).toBe("改写后的虚构文字");
});

test("密钥只有打开“在此设备记住”才写进存储，清除后就没了", async ({ page }) => {
  await page.goto("/tools/batch-text/");
  await openSettings(page);
  await page.getByLabel("接口密钥").fill(KEY);
  expect(await storedValues(page)).not.toContain(KEY);

  await page.getByRole("switch", { name: "在此设备记住" }).click();
  await expect.poll(() => storedValues(page)).toContain(KEY);
  await page.reload();
  await openSettings(page);
  await expect(page.getByLabel("接口密钥")).toHaveValue(KEY);

  await page.getByRole("button", { name: "清除已保存的密钥" }).click();
  await expect(page.getByLabel("接口密钥")).toHaveValue("");
  expect(await storedValues(page)).not.toContain(KEY);
  await page.reload();
  await openSettings(page);
  await expect(page.getByLabel("接口密钥")).toHaveValue("");
  await expect(page.getByRole("switch", { name: "在此设备记住" })).not.toBeChecked();
});

test("导出的配置文件默认不含密钥", async ({ page }) => {
  await page.goto("/tools/batch-text/");
  await openSettings(page);
  await page.getByLabel("接口密钥").fill(KEY);
  await page.getByRole("button", { name: "管理接口" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出" }).click()]);
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("默认配置");
  expect(text).not.toContain(KEY);
});

/** 状态标签只在文件列表里数，不和状态栏里的“处理中 0”混在一起。 */
function statusTags(page: Page, label: string) {
  return page.getByRole("list", { name: "文件" }).getByText(label, { exact: true });
}

test("第一次打开显示示例数据，加了文件就消失，示例不会发出去", async ({ page }) => {
  const bodies = await mockLlm(page, (route) => reply(route, "好"));
  await page.goto("/tools/batch-text/");
  await openSettings(page);
  const examples = page.getByRole("region", { name: "示例数据" });
  await expect(examples.getByRole("listitem")).toHaveCount(3);
  // 只有一套配置、一个模板时不显示成可选的单选项
  await expect(page.getByRole("radiogroup", { name: /接口配置|提示词模板/ })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "提示词模板" }).getByText("正在用")).toBeVisible();
  await expect(page.getByRole("group", { name: "接口配置" }).getByText("正在用")).toBeVisible();
  await expect(page.getByRole("group", { name: "接口配置" }).getByText("还没填模型")).toBeVisible();

  // 默认不预填模型，开始前说清楚缺什么
  await page.getByLabel("接口密钥").fill(KEY);
  await addFiles(page, ["一段虚构的文字。"]);
  await expect(examples).toHaveCount(0);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(page.getByText(/模型名还没填/)).toBeVisible();
  expect(bodies).toHaveLength(0);
});

test("Markdown 预览不加载图片，不安全的链接按文字显示", async ({ page }) => {
  const imageRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("img.example.test")) imageRequests.push(r.url());
  });
  await mockLlm(page, (route) =>
    reply(route, "# 标题\n\n![林间小屋](https://img.example.test/p.png?d=secret)\n\n[坏链接](javascript:alert(1)) 和 [正常链接](https://www.example.com/)"),
  );
  await setUp(page);
  await addFiles(page, ["甲"]);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(statusTags(page, "完成")).toHaveCount(1);
  await page.getByRole("list", { name: "文件" }).getByRole("button", { name: /^示例1\.txt/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "示例1.txt" });
  await dialog.getByRole("radio", { name: "Markdown" }).click();
  await expect(dialog.getByRole("heading", { name: "标题" })).toBeVisible();
  await expect(dialog.getByText("[图片：林间小屋]")).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(0);
  await expect(page.locator("link[rel='preload'][as='image']")).toHaveCount(0);
  await expect(dialog.getByText("坏链接")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "坏链接" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "正常链接" })).toHaveAttribute("href", "https://www.example.com/");
  await page.waitForTimeout(300);
  expect(imageRequests).toEqual([]);
});

test("处理中离开页面再回来，不会卡在处理中", async ({ page }) => {
  const bodies = await mockLlm(page, () => new Promise<void>(() => {}));
  await setUp(page, { from: "/tools/" });
  await addFiles(page, ["一", "二"]);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect.poll(() => bodies.length).toBe(1);
  await expect(statusTags(page, "处理中")).toHaveCount(1);

  // 站内后退、前进，不重新加载页面：模块里的文件和状态都还在。标记用来确认确实没有重新加载
  await page.evaluate(() => Object.assign(window, { __sameDocument: true }));
  await page.goBack();
  await expect(page).toHaveURL(/\/tools\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/tools\/batch-text\/$/);
  expect(await page.evaluate(() => "__sameDocument" in window)).toBe(true);
  await expect(page.getByRole("button", { name: "开始处理" })).toBeVisible();
  await expect(statusTags(page, "待处理")).toHaveCount(2);
  await expect(statusTags(page, "处理中")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(bodies).toHaveLength(1);
});

test("运行中移除待处理的文件，进度照样走完", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await mockLlm(page, async (route) => {
    await gate;
    await reply(route, "好");
  });
  await setUp(page);
  await addFiles(page, ["一", "二", "三"]);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(statusTags(page, "处理中")).toHaveCount(1);
  await page.getByRole("button", { name: "移除 示例3.txt" }).click();
  await expect(page.getByText("处理进度 0 / 2")).toBeVisible();
  release();
  await expect(page.getByText("处理完了：2 条全部成功")).toBeVisible();
  await expect(statusTags(page, "完成")).toHaveCount(2);
});

test("运行中撤销清空：先停下，清空前的文件回来，新加的保留", async ({ page }) => {
  const bodies = await mockLlm(page, () => new Promise<void>(() => {}));
  await setUp(page);
  await addFiles(page, ["一", "二"]);
  await page.getByRole("button", { name: "清空" }).click();
  await page
    .locator("input[type='file'][accept*='.md']")
    .first()
    .setInputFiles([{ name: "新文件.txt", mimeType: "text/plain", buffer: Buffer.from("新的虚构文字") }]);
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect.poll(() => bodies.length).toBe(1);
  // 轻提示叠在一起时只有最上面那条的按钮露出来，悬停展开（也会暂停自动消失）
  await page.locator("[data-sonner-toast]").first().hover();
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByRole("button", { name: "开始处理" })).toBeVisible();
  await expect(page.getByRole("list", { name: "文件" }).getByRole("listitem")).toHaveCount(3);
  await expect(statusTags(page, "待处理")).toHaveCount(3);
});

test("超过 2 MB 的文件不添加，并说明原因", async ({ page }) => {
  await page.goto("/tools/batch-text/");
  await openSettings(page);
  await page
    .locator("input[type='file'][accept*='.md']")
    .first()
    .setInputFiles([{ name: "太大了.txt", mimeType: "text/plain", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, "a") }]);
  await expect(page.getByText(/太大了\.txt 超过 2 MB/)).toBeVisible();
  await expect(page.getByRole("list", { name: "文件" })).toHaveCount(0);
});

// 接口报错里遮住密钥由单元测试覆盖：非 2xx 回复会在控制台留下一条加载失败，冒烟测试的夹具会把它当成报错
test("密钥里有不能用的字符时开始前就说明，不发请求", async ({ page }) => {
  const bodies = await mockLlm(page, (route) => reply(route, "好"));
  await setUp(page);
  await addFiles(page, ["甲"]);
  await page.getByLabel("接口密钥").fill("sk-复制多了");
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(page.getByText(/接口密钥里有空格、中文/)).toBeVisible();
  await expect(statusTags(page, "待处理")).toHaveCount(1);
  expect(bodies).toHaveLength(0);
});

test("另一个标签页清除了保存的密钥，这边跟着关掉记住，不会再写回去", async ({ page, context }) => {
  await page.goto("/tools/batch-text/");
  await openSettings(page);
  await page.getByLabel("接口密钥").fill(KEY);
  await page.getByRole("switch", { name: "在此设备记住" }).click();
  await expect.poll(() => storedValues(page)).toContain(KEY);

  const other = await context.newPage();
  await other.goto("/tools/batch-text/");
  await openSettings(other);
  await expect(other.getByLabel("接口密钥")).toHaveValue(KEY);
  await other.getByRole("button", { name: "清除已保存的密钥" }).click();
  await expect.poll(() => storedValues(other)).not.toContain(KEY);

  await expect(page.getByRole("switch", { name: "在此设备记住" })).not.toBeChecked();
  await expect(page.getByLabel("接口密钥")).toHaveValue("");
  // 这边再改一次密钥也不会把旧密钥写回存储
  await page.getByLabel("接口密钥").fill("sk-fictional-e2e-1111");
  await page.waitForTimeout(200);
  expect(await storedValues(page)).not.toContain("sk-fictional-e2e");
  await other.close();
});

test("这边只在内存里存密钥时，另一个标签页打开记住不会换掉这边的密钥和开关", async ({ page, context }) => {
  const mine = "sk-fictional-e2e-mine";
  const theirs = "sk-fictional-e2e-theirs";
  await page.goto("/tools/batch-text/");
  await openSettings(page);
  await page.getByLabel("接口密钥").fill(mine);

  const other = await context.newPage();
  await other.goto("/tools/batch-text/");
  await openSettings(other);
  await other.getByLabel("接口密钥").fill(theirs);
  await other.getByRole("switch", { name: "在此设备记住" }).click();
  await expect.poll(() => storedValues(other)).toContain(theirs);
  // 那边又改一次，确保这边已经收到过 storage 事件
  await other.getByLabel("接口密钥").fill(`${theirs}2`);
  await expect.poll(() => storedValues(other)).toContain(`${theirs}2`);

  await expect(page.getByLabel("接口密钥")).toHaveValue(mine);
  await expect(page.getByRole("switch", { name: "在此设备记住" })).not.toBeChecked();
  // 这边改自己内存里的密钥，不会把那边记住的删掉
  await page.getByLabel("接口密钥").fill(`${mine}2`);
  await page.waitForTimeout(200);
  expect(await storedValues(page)).toContain(`${theirs}2`);
  expect(await storedValues(page)).not.toContain(mine);
  await other.close();
});
