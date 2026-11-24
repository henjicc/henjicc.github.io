import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// 平台差异只能经 src/platform/：页面、外壳和工具不直接碰这些浏览器接口（TOY 里它们的行为和网站不同）。
const PLATFORM_ONLY = "改用 ~/platform（网站和 B 站 TOY 的差异都收在平台适配层，见 docs/development-plan.md 第 3 节）";

export default tseslint.config(
  {
    ignores: [
      "build/",
      "dist-toy/",
      ".react-router/",
      "node_modules/",
      "playwright-report/",
      "test-results/",
      ".local/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat["recommended-latest"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: PLATFORM_ONLY },
        { name: "sessionStorage", message: PLATFORM_ONLY },
        { name: "location", message: PLATFORM_ONLY },
        { name: "open", message: PLATFORM_ONLY },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "open", message: PLATFORM_ONLY },
        { object: "window", property: "localStorage", message: PLATFORM_ONLY },
        { object: "window", property: "sessionStorage", message: PLATFORM_ONLY },
        { object: "window", property: "location", message: PLATFORM_ONLY },
        { object: "globalThis", property: "localStorage", message: PLATFORM_ONLY },
        { object: "globalThis", property: "location", message: PLATFORM_ONLY },
        { object: "document", property: "location", message: PLATFORM_ONLY },
        { object: "navigator", property: "clipboard", message: PLATFORM_ONLY },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[property.name='clipboard'][object.property.name='navigator']", message: PLATFORM_ONLY },
      ],
    },
  },
  {
    // 平台适配层本身，以及 TOY 入口里把 ?p= 深链转成哈希路由的那几行
    files: ["src/platform/**", "src/toy/entry.tsx"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off", "no-restricted-syntax": "off" },
  },
  {
    files: ["*.ts", "*.js", "scripts/**/*.ts", "e2e/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
);
