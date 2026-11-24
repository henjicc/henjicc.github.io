import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath, type Plugin, type UserConfig } from "vite";
import { themeBootScript } from "./src/shell/theme-boot.ts";

// B 站 TOY 包（由 scripts/toy.ts 调用，不直接用）：同一批页面组件，哈希路由，相对路径，只在这里注入官方 SDK。
// 打包目标和要放进包里的工具由 scripts/toy.ts 通过环境变量传进来。
export const TOY_SDK_URL = "https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

/**
 * 把 src/tools/registry.ts 换成只含选中工具的版本，没选中的工具连代码都不进包。
 * 生成的写法和 registry.ts 里的约定一致：defineTool(<id>/meta, () => import("./<id>/Tool"))。
 */
function toyRegistry(ids: string[]): Plugin {
  const registry = normalizePath(src("tools/registry.ts"));
  return {
    name: "henji:toy-registry",
    enforce: "pre",
    load(id) {
      if (normalizePath(id.split("?")[0] ?? id) !== registry) return null;
      const lines = ['import { defineTool } from "./define";'];
      ids.forEach((tool, i) => lines.push(`import meta${i} from "./${tool}/meta";`));
      lines.push(`export const tools = [${ids.map((tool, i) => `defineTool(meta${i}, () => import("./${tool}/Tool"))`).join(", ")}];`);
      return lines.join("\n");
    },
  };
}

function toyHtml(title: string): Plugin {
  return {
    name: "henji:toy-html",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return {
          html: html.replace("%TOY_TITLE%", title),
          tags: [
            { tag: "script", children: themeBootScript, injectTo: "head-prepend" },
            { tag: "script", attrs: { src: TOY_SDK_URL }, injectTo: "head" },
          ],
        };
      },
    },
  };
}

export default defineConfig((): UserConfig => {
  const target = process.env.TOY_TARGET;
  const ids = (process.env.TOY_TOOLS ?? "").split(",").filter(Boolean);
  const title = process.env.TOY_TITLE;
  if (!target || !ids.length || !title) throw new Error("TOY 包请用 npm run toy -- <目标> 构建");
  return {
    root: src("toy"),
    base: "./",
    publicDir: false,
    define: {
      __PLATFORM__: JSON.stringify("toy"),
      __TOY_TARGET__: JSON.stringify(target),
    },
    resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
    plugins: [toyRegistry(ids), toyHtml(title), tailwindcss(), react()],
    build: {
      outDir: fileURLToPath(new URL(`./dist-toy/${target}`, import.meta.url)),
      emptyOutDir: true,
      sourcemap: false,
      // 图片字体都输出成单独文件，打包检查才能逐个核对后缀是否在 TOY 的白名单里
      assetsInlineLimit: 0,
    },
  };
});
