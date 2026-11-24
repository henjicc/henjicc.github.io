// 构建时由 vite.config.ts / vite.toy.config.ts 注入的常量。
declare const __PLATFORM__: "web" | "toy";
// TOY 打包目标："toolbox" 是工具箱合集，其余是单个工具的 id；网站构建时为 null。
declare const __TOY_TARGET__: string | null;
