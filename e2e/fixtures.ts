import { test as base, expect } from "@playwright/test";

/**
 * 每个用例结束时断言控制台没有报错、页面没有未捕获的异常。
 * 只有文档本身就该是 404 的用例才用 allowDocument404 放过浏览器对它的那一条报错。
 */
export const test = base.extend<{ allowDocument404: boolean; consoleErrors: string[] }>({
  allowDocument404: [false, { option: true }],
  consoleErrors: [
    async ({ page, allowDocument404 }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const documentIs404 =
          allowDocument404 && msg.text().includes("status of 404") && msg.location().url === page.url();
        if (!documentIs404) errors.push(`${msg.text()} @ ${msg.location().url}`);
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "控制台不应有报错").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
