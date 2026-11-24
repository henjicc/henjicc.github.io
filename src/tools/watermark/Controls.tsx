import { Grid3x3, ImageIcon, LayoutGrid, Palette, Type } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useRef, useState } from "react";
import { platform } from "~/platform";
import { ControlGroup } from "~/shell/tool/ControlGroup";
import { Button } from "~/ui/button";
import { fieldBox } from "~/ui/input";
import { cn } from "~/ui/lib/utils";
import { Segmented } from "~/ui/segmented";
import { Slider } from "~/ui/slider";
import { toast } from "~/ui/sonner";
import { Swatches } from "~/ui/swatches";
import { Switch } from "~/ui/switch";
import { TextField } from "~/ui/text-field";
import { Textarea } from "~/ui/textarea";
import { chooseMarkImage, factoryReset, patchSettings, saveAsDefaults, setUnit, updateSettings } from "./actions";
import {
  applyPosition,
  CELL_NAMES,
  CELLS,
  FONTS,
  LOCAL_FONT_PREFIX,
  OFFSET_RANGE,
  ROTATION_RANGE,
  SIZE_RANGE,
  SPACING_RANGE,
  type Cell,
  type ExportFormat,
  type FontId,
  type MarkSettings,
} from "./logic/settings";
import { Presets } from "./Presets";
import { useApp, useDraft, useLibrary } from "./store";

// 水印颜色是用户要用的内容色，不是界面颜色
const COLORS = [
  { value: "#ffffff", name: "白" },
  { value: "#111111", name: "黑" },
  { value: "#06b6ff", name: "天光" },
  { value: "#f2bb55", name: "琥珀" },
  { value: "#e5484d", name: "红" },
] as const;

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "auto", label: "自动" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
];

function PositionGrid({ value, onChange }: { value: Cell | null; onChange: (cell: Cell) => void }) {
  return (
    <RadioGroup.Root
      aria-label="九宫格位置"
      value={value ?? ""}
      onValueChange={(v) => onChange(v as Cell)}
      orientation="horizontal"
      loop
      className="grid w-[156px] grid-cols-3 gap-1.5"
    >
      {CELLS.map((cell) => (
        <RadioGroup.Item
          key={cell}
          value={cell}
          aria-label={CELL_NAMES[cell]}
          className="group grid h-10 cursor-pointer place-items-center rounded-sm border border-line bg-surface-raised p-0 transition-colors duration-(--dur-quick) ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring data-[state=checked]:border-sky-line data-[state=checked]:bg-sky-soft"
        >
          <i aria-hidden className="size-2 rounded-[3px] bg-ink-faint group-data-[state=checked]:bg-sky" />
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

type LocalFontData = { family: string };
type FontWindow = Window & { queryLocalFonts?: () => Promise<LocalFontData[]> };

function FontPicker({ font, onChange }: { font: string; onChange: (font: string) => void }) {
  const [localFonts, setLocalFonts] = useState<string[] | null>(null);
  const canQuery = typeof window !== "undefined" && "queryLocalFonts" in window;
  const isLocal = font.startsWith(LOCAL_FONT_PREFIX);

  async function loadLocal() {
    try {
      const fonts = await (window as FontWindow).queryLocalFonts!();
      const families = [...new Set(fonts.map((f) => f.family).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      setLocalFonts(families);
      if (families[0] && !isLocal) onChange(LOCAL_FONT_PREFIX + families[0]);
    } catch {
      toast.error("没拿到本机字体，浏览器需要你允许访问字体");
    }
  }

  const options = localFonts ?? (isLocal ? [font.slice(LOCAL_FONT_PREFIX.length)] : null);
  return (
    <div className="grid gap-2">
      <span id="wm-font" className="text-ui text-ink">
        字体
      </span>
      <Segmented<FontId>
        label="字体"
        block
        value={(isLocal ? "" : font) as FontId}
        onValueChange={onChange}
        options={(Object.keys(FONTS) as FontId[]).map((id) => ({ value: id, label: FONTS[id].label }))}
      />
      {options ? (
        <select
          aria-labelledby="wm-font"
          value={isLocal ? font : ""}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className={cn(fieldBox, "h-10 px-2")}
        >
          {isLocal ? null : <option value="">本机字体</option>}
          {options.map((family) => (
            <option key={family} value={LOCAL_FONT_PREFIX + family}>
              {family}
            </option>
          ))}
        </select>
      ) : canQuery ? (
        <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => void loadLocal()}>
          使用本机字体
        </Button>
      ) : null}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const valid = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
  return (
    <div className="grid gap-2">
      <span className="text-ui text-ink">颜色</span>
      <div className="flex flex-wrap items-center gap-2">
        <Swatches label="颜色" value={value.toLowerCase()} onValueChange={onChange} colors={COLORS} />
        <label className="focus-within:outline-focus-ring relative grid size-8 cursor-pointer place-items-center rounded-sm border border-line-strong bg-surface-raised text-ink-muted focus-within:outline-2 focus-within:outline-offset-2">
          <Palette aria-hidden className="size-4" />
          <input type="color" aria-label="选择其他颜色" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
      </div>
      <TextField
        label="色值"
        value={draft ?? value}
        spellCheck={false}
        maxLength={7}
        error={draft !== null && !valid(draft) ? "写成 # 加 6 位十六进制，如 #FFFFFF" : undefined}
        onChange={(v) => {
          const next = v.startsWith("#") ? v : `#${v}`;
          setDraft(next);
          if (valid(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

function MarkImagePicker() {
  const markId = useDraft((d) => d.current.markId);
  const mark = useLibrary((l) => (markId ? l.marks[markId] : undefined));
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-3">
      {mark ? (
        <div className="flex items-center gap-3">
          <img src={mark.dataUrl} alt="" className="size-12 flex-none rounded-sm bg-surface-sunken object-contain" />
          <span className="min-w-0 flex-1 truncate text-ui">{mark.name}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => input.current?.click()}>
          <ImageIcon aria-hidden />
          {mark ? "更换图片" : "选择水印图片"}
        </Button>
        {mark ? (
          <Button size="sm" variant="ghost" onClick={() => patchSettings({ markId: null })}>
            移除图片
          </Button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/*,.svg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) chooseMarkImage(f).catch(() => toast.error("这张图片打不开，换一张 PNG 或 SVG 试试"));
        }}
      />
    </div>
  );
}

export function Controls({ settings }: { settings: MarkSettings }) {
  const { unit, useFilename, format, quality, defaults } = useApp();
  const s = settings;
  const tile = s.position === "tile";
  const sizeRange = SIZE_RANGE[unit];

  return (
    <>
      <ControlGroup title="水印">
        <Segmented
          label="水印类型"
          block
          value={s.type}
          onValueChange={(type) => patchSettings({ type })}
          options={[
            { value: "text", label: "文字", icon: Type },
            { value: "image", label: "图片", icon: ImageIcon },
          ]}
        />
        {s.type === "text" ? (
          <div className="grid gap-2">
            <label htmlFor="wm-text" className="text-ui text-ink">
              水印文字
            </label>
            <Textarea id="wm-text" rows={3} className="min-h-24" value={s.text} spellCheck={false} onChange={(e) => patchSettings({ text: e.target.value })} />
          </div>
        ) : (
          <MarkImagePicker />
        )}
      </ControlGroup>

      <ControlGroup title="位置">
        <Segmented
          label="排布方式"
          block
          value={tile ? "tile" : "grid"}
          onValueChange={(v) => updateSettings(applyPosition(s, v === "tile" ? "tile" : "center"))}
          options={[
            { value: "grid", label: "九宫格", icon: Grid3x3 },
            { value: "tile", label: "整张平铺", icon: LayoutGrid },
          ]}
        />
        {tile ? null : <PositionGrid value={s.position === "tile" ? null : s.position} onChange={(cell) => updateSettings(applyPosition(s, cell))} />}
        <Slider label="水平位移" editable {...OFFSET_RANGE} value={s.offsetX} resetValue={defaults.offsetX} onValueChange={(offsetX) => patchSettings({ offsetX })} />
        <Slider label="垂直位移" editable {...OFFSET_RANGE} value={s.offsetY} resetValue={defaults.offsetY} onValueChange={(offsetY) => patchSettings({ offsetY })} />
        {tile ? (
          <>
            <Slider label="水平间隔" editable unit="%" {...SPACING_RANGE} value={s.spacingX} resetValue={defaults.spacingX} onValueChange={(spacingX) => patchSettings({ spacingX })} />
            <Slider label="垂直间隔" editable unit="%" {...SPACING_RANGE} value={s.spacingY} resetValue={defaults.spacingY} onValueChange={(spacingY) => patchSettings({ spacingY })} />
          </>
        ) : null}
      </ControlGroup>

      <ControlGroup title="样式">
        <Slider
          label="大小"
          editable
          unit={unit === "percent" ? "%" : " px"}
          {...sizeRange}
          step={unit === "percent" ? 0.5 : 1}
          value={s.size}
          resetValue={Math.min(sizeRange.max, Math.max(sizeRange.min, defaults.size))}
          onValueChange={(size) => patchSettings({ size })}
        />
        <Slider label="旋转" editable unit="°" {...ROTATION_RANGE} value={s.rotation} resetValue={defaults.rotation} onValueChange={(rotation) => patchSettings({ rotation })} />
        <Slider
          label="不透明度"
          editable
          unit="%"
          min={10}
          max={100}
          value={Math.round(s.opacity * 100)}
          resetValue={Math.round(defaults.opacity * 100)}
          onValueChange={(v) => patchSettings({ opacity: v / 100 })}
        />
        {s.type === "text" ? (
          <>
            <ColorPicker value={s.color} onChange={(color) => patchSettings({ color })} />
            <FontPicker font={s.font} onChange={(font) => patchSettings({ font })} />
          </>
        ) : null}
      </ControlGroup>

      <Presets />

      <ControlGroup title="导出">
        {platform.kind === "toy" ? (
          <p className="m-0 text-caption text-ink-muted">存到相册时统一存为 JPEG</p>
        ) : (
          <>
            <Segmented label="导出格式" block value={format} onValueChange={(v) => useApp.setState({ format: v })} options={FORMATS} />
            {format === "png" ? null : (
              <Slider
                label="质量"
                editable
                unit="%"
                min={10}
                max={100}
                step={5}
                value={Math.round(quality * 100)}
                resetValue={95}
                onValueChange={(v) => useApp.setState({ quality: v / 100 })}
              />
            )}
          </>
        )}
      </ControlGroup>

      <ControlGroup title="偏好">
        <div className="grid gap-2">
          <span className="text-ui text-ink">大小按</span>
          <Segmented
            label="大小按"
            block
            value={unit}
            onValueChange={setUnit}
            options={[
              { value: "percent", label: "图片宽度比例" },
              { value: "px", label: "像素" },
            ]}
          />
        </div>
        <Switch label="用文件名作水印文字" checked={useFilename} onCheckedChange={(v) => useApp.setState({ useFilename: v })} />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              saveAsDefaults();
              toast.success("已设为默认");
            }}
          >
            把当前设置设为默认
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const before = useApp.getState();
              factoryReset();
              toast("已恢复出厂设置", { action: { label: "撤销", onClick: () => useApp.setState(before) } });
            }}
          >
            恢复出厂设置
          </Button>
        </div>
      </ControlGroup>
    </>
  );
}
