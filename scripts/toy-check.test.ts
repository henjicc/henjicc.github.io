import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkToyPackage, TOY_SDK_MARK } from "./toy-check.ts";

const dirs: string[] = [];
function pack(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "toy-check-"));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const goodHtml = `<!doctype html><title>痕迹工具箱</title><script src="https://${TOY_SDK_MARK}"></script><script type="module" src="./assets/a.js"></script>`;

describe("checkToyPackage", () => {
  it("合规的包通过", () => {
    const r = checkToyPackage(pack({ "index.html": goodHtml, "assets/a.js": "import('./b.js')" }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.files.map((f) => f.path).sort()).toEqual(["assets/a.js", "index.html"]);
  });

  it("拦下会被过滤的后缀、根路径资源和缺 SDK", () => {
    const r = checkToyPackage(
      pack({
        "index.html": `<title>x</title><link href="/assets/a.css">`,
        "assets/a.css": "body{background:url(/bg.png)}",
        "assets/a.js": 'fetch("/assets/data.json")',
        "photo.avif": "x",
        "assets/a.js.map": "{}",
      }),
    );
    const text = r.errors.join("\n");
    expect(text).toContain("photo.avif");
    expect(text).toContain("a.js.map");
    expect(text).toContain("HTML 里的根路径引用");
    expect(text).toContain("CSS 里的根路径引用");
    expect(text).toContain("脚本里的 /assets/ 路径");
    expect(text).toContain("没有引入 TOY SDK");
  });

  it("没有 index.html、超过上限时报错", () => {
    const r = checkToyPackage(pack({ "main.js": "x".repeat(2048) }), 0.001);
    expect(r.errors.join("\n")).toMatch(/没有 index\.html[\s\S]*超过上限/);
  });
});
