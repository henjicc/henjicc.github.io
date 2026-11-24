import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { liveTools, toolPath } from "~/tools/lookup";
import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/ui/command";
import { Kbd } from "~/ui/kbd";
import { isToy, singleToolId } from "./env";
import { sitePages } from "./nav";
import { setPaletteOpen, usePalette } from "./palette";
import { resolveTheme, toggleTheme, useThemeStore } from "./theme";

// 命令面板：按组列出小工具、页面和操作，输入时按名称和拼音首字母过滤（拼音写在登记表的 keywords 里）。
// 按需加载（见 AppShell），所以 cmdk 不进首页首屏的包。
export default function CommandPalette() {
  const open = usePalette((s) => s.open);
  const choice = useThemeStore((s) => s.choice);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const night = resolveTheme(choice) === "night";

  function go(to: string) {
    setPaletteOpen(false);
    void navigate(to, { viewTransition: true });
  }

  const pages = isToy ? [] : sitePages;
  const tools = singleToolId ? [] : liveTools;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setPaletteOpen(next);
        if (!next) setQuery("");
      }}
      label="搜索"
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="搜索工具和页面" autoFocus />
      <CommandList>
        <CommandEmpty>没有找到“{query}”</CommandEmpty>
        {tools.length ? (
          <CommandGroup heading="小工具">
            {tools.map((t) => (
              <CommandItem key={t.id} value={`tool:${t.id}`} keywords={[t.name, t.id, ...t.keywords]} onSelect={() => go(isToy ? `/tools/${t.id}` : toolPath(t.id))}>
                <t.icon aria-hidden />
                <span>{t.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {pages.length ? (
          <CommandGroup heading="页面">
            {pages.map((p) => (
              <CommandItem key={p.path} value={`page:${p.path}`} keywords={[p.label, ...p.keywords]} onSelect={() => go(p.path)}>
                <p.icon aria-hidden />
                <span>{p.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="操作">
          <CommandItem
            value="action:theme"
            keywords={["切换主题", "zt", "qhzt", "theme", night ? "晨雾" : "夜雾"]}
            onSelect={() => {
              setPaletteOpen(false);
              // 等面板关掉再切，圆形扩散才不会把面板也拍进去
              setTimeout(() => toggleTheme(), 0);
            }}
          >
            {night ? <Sun aria-hidden /> : <Moon aria-hidden />}
            <span>切换到{night ? "晨雾" : "夜雾"}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <CommandFooter>
        <span>
          <Kbd>↑↓</Kbd>移动
        </span>
        <span>
          <Kbd>Enter</Kbd>打开
        </span>
        <span>
          <Kbd>Esc</Kbd>关闭
        </span>
      </CommandFooter>
    </CommandDialog>
  );
}
