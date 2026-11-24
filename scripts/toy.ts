// npm run toy -- <目标> [--preview | --publish]
//   目标：toolbox（工具箱合集：工具列表 + 所有能上 TOY 的工具），或单个工具的 id。
// 打包到 dist-toy/<目标>/，按 TOY 的规则检查，生成封面和图标到 dist-toy/<目标>-assets/。
// 这个脚本从不上传：--preview / --publish 只打印要执行的官方 Toy CLI 命令，由作者确认后自己运行。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build, runnerImport } from "vite";
import { checkToyPackage, DEFAULT_LIMIT_MB } from "./toy-check.ts";
import { renderCovers, type CoverTool } from "./toy-cover.ts";

type ToolInfo = { id: string; name: string; summary: string; status: string; toy: boolean; icon: ComponentType<{ size?: number }> };
type ToyRecord = { id?: number | string; slug?: string; title?: string; visibility?: string };

const TOOLBOX = "toolbox";
const TOOLBOX_TITLE = "痕迹工具箱";
const TOOLBOX_TAGLINE = "打开就能用的小工具，不上传任何文件。";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const wantPreview = args.includes("--preview");
const wantPublish = args.includes("--publish");

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

if (!target) fail("用法：npm run toy -- <toolbox | 工具 id> [--preview | --publish]");

// 在 Node 里加载 TS 写的登记表（经 Vite 的模块运行器，不加载网站的 Vite 配置）
const inline = { configFile: false as const, logLevel: "error" as const };
const { module: registry } = await runnerImport<{ tools: ToolInfo[] }>("./src/tools/registry.ts", inline);
const { module: schema } = await runnerImport<{ validateRegistry: (t: ToolInfo[]) => void }>("./src/tools/schema.ts", inline);
const { module: logo } = await runnerImport<{ LOGO_PATH: string; LOGO_VIEWBOX: { width: number; height: number } }>("./src/ui/logo-path.ts", inline);
schema.validateRegistry(registry.tools);

const toyTools = registry.tools.filter((t) => t.status === "live" && t.toy);
let selected: ToolInfo[];
if (target === TOOLBOX) {
  selected = toyTools;
} else {
  const tool = registry.tools.find((t) => t.id === target);
  if (!tool) fail(`登记表里没有工具 ${target}。能打的目标：${[TOOLBOX, ...toyTools.map((t) => t.id)].join("、")}`);
  if (tool.status !== "live" || !tool.toy) fail(`${target} 没有标成可以上 TOY（meta.ts 里的 status / toy）`);
  selected = [tool];
}
if (!selected.length) fail("没有能放进 TOY 的工具");

const recordFile = join("toy", `${target}.json`);
const record: ToyRecord = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, "utf8")) : {};
const single = target !== TOOLBOX;
const title = record.title ?? (single ? selected[0]!.name : TOOLBOX_TITLE);
const outDir = join("dist-toy", target);
const assetsDir = join("dist-toy", `${target}-assets`);

console.log(`TOY 目标：${target}（${selected.map((t) => t.name).join("、")}）`);
process.env.TOY_TARGET = target;
process.env.TOY_TOOLS = selected.map((t) => t.id).join(",");
process.env.TOY_TITLE = title;
await build({ configFile: "vite.toy.config.ts", mode: "production", logLevel: "warn" });

const limitMb = Number(process.env.TOY_LIMIT_MB ?? DEFAULT_LIMIT_MB);
const result = checkToyPackage(outDir, limitMb);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`\nTOY 包：${outDir}`);
for (const f of result.files) console.log(`  ${f.path.padEnd(44)} ${kb(f.bytes).padStart(10)}   gzip ${kb(f.gzip).padStart(9)}`);
const gzipTotal = result.files.reduce((n, f) => n + f.gzip, 0);
console.log(`合计 ${result.files.length} 个文件，${kb(result.bytes)}（gzip ${kb(gzipTotal)}），上限 ${limitMb} MB`);
for (const w of result.warnings) console.log(`提醒：${w}`);
if (result.errors.length) {
  for (const e of result.errors) console.log(`错误：${e}`);
  fail("检查没通过，不能上传。");
}
console.log("检查通过。");

const covers: CoverTool[] = selected.map((t) => ({
  name: t.name,
  summary: t.summary,
  iconSvg: renderToStaticMarkup(createElement(t.icon, { size: 64 })),
}));
let poster = join(assetsDir, "poster.png");
let icon = join(assetsDir, "icon.png");
try {
  ({ poster, icon } = await renderCovers(
    {
      title,
      tagline: single ? selected[0]!.summary : TOOLBOX_TAGLINE,
      tools: covers,
      logoPath: logo.LOGO_PATH,
      logoViewBox: `0 0 ${logo.LOGO_VIEWBOX.width} ${logo.LOGO_VIEWBOX.height}`,
      single,
    },
    assetsDir,
  ));
  console.log(`封面：${poster}（1200 × 900）\n图标：${icon}（500 × 500）`);
} catch (error) {
  // 封面只在上传时用得到，生成不了不影响包本身
  console.warn(`封面和图标没生成（${error instanceof Error ? error.message.split("\n")[0] : String(error)}），上传前另外准备。`);
}

if (wantPreview || wantPublish) {
  const dir = outDir.replaceAll("\\", "/");
  const files = `--poster ${poster.replaceAll("\\", "/")} --icon ${icon.replaceAll("\\", "/")}`;
  console.log("\n这个脚本不会上传。任何上传（包括只拿预览链接）都要作者先同意，确认后自己运行：");
  if (wantPreview) {
    console.log(`  官方 Toy CLI 的预览命令没有记录在仓库里，先用 \`toy --help\` 查到预览子命令，再对 ${dir} 执行。`);
  }
  if (wantPublish) {
    if (record.id) {
      console.log(`  toy update ${record.id} ${dir}`);
    } else {
      console.log(`  toy create ${dir} --category TOOL --visibility ${record.visibility ?? "password"} ${files}`);
      console.log(`  路径发布后不能改，第一次起名要定好；发布后把 id、路径、标题、可见性写进 ${recordFile.replaceAll("\\", "/")}。`);
    }
  }
}
