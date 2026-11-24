import { Check } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "~/shell/media";
import { Button } from "~/ui/button";
import { cn } from "~/ui/lib/utils";
import { Tag } from "~/ui/tag";
import { clickImage, enterSelectMode, exitSelectMode, removeImages, resetToDefaults, syncToSelected, targets, toggleSelectAll } from "./actions";
import { fitPixels } from "./logic/output";
import type { Mark } from "./logic/presets";
import type { MarkSettings, SizeUnit } from "./logic/settings";
import { decodeAt, drawSample, loadMark, PREVIEW_MAX_SIDE } from "./image";
import { drawWatermarked, planFor } from "./render";
import { useSession, type ImageItem } from "./store";
import { toast } from "~/ui/sonner";

const SAMPLE_SIZE = { width: 1600, height: 1000 };
const LONG_PRESS_MS = 500;

type Decoded = { source: CanvasImageSource; release: () => void };
// 预览位图只留最近看过的几张：每张约 10MB，图一多手机内存吃不消；切回去时重新解码很快。
const previewCache = new Map<string, Promise<Decoded>>();
const PREVIEW_CACHE_SIZE = 3;

function previewSource(item: ImageItem): Promise<Decoded> {
  let p = previewCache.get(item.id);
  if (p) {
    previewCache.delete(item.id);
  } else {
    const size = fitPixels(item.width, item.height, Infinity, PREVIEW_MAX_SIDE);
    p = decodeAt(item.decodable, size.width, size.height);
  }
  previewCache.set(item.id, p);
  while (previewCache.size > PREVIEW_CACHE_SIZE) {
    const [oldest, evicted] = previewCache.entries().next().value!;
    previewCache.delete(oldest);
    void evicted.then((d) => d.release(), () => {});
  }
  return p;
}

function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** 预览：画布按舞台大小和屏幕像素比开，用和导出同一个绘制方案、按比例缩小着画。 */
function Preview({ item, settings, unit, mark }: { item: ImageItem | null; settings: MarkSettings; unit: SizeUnit; mark: Mark | undefined }) {
  const [box, boxSize] = useBoxSize();
  const canvas = useRef<HTMLCanvasElement>(null);
  const sample = useMemo(() => (typeof document === "undefined" ? null : drawSample()), []);
  const [source, setSource] = useState<{ id: string | null; image: CanvasImageSource } | null>(null);
  const [markImage, setMarkImage] = useState<{ id: string; image: HTMLImageElement } | null>(null);
  const original = item ?? SAMPLE_SIZE;

  const loadedId = source?.id;
  useEffect(() => {
    // 改设置时 item 会换成新对象，但图没变，不用重新取
    if (!item || loadedId === item.id) return;
    let live = true;
    previewSource(item).then(
      (d) => live && setSource({ id: item.id, image: d.source }),
      () => live && toast.error(`这张图预览不了：${item.name}`),
    );
    return () => {
      live = false;
    };
  }, [item, loadedId]);

  const markId = settings.type === "image" ? (mark?.id ?? null) : null;
  useEffect(() => {
    if (!mark || !markId) return;
    let live = true;
    void loadMark(mark).then((image) => live && setMarkImage({ id: mark.id, image }));
    return () => {
      live = false;
    };
  }, [mark, markId]);

  const image = item ? (source?.id === item.id ? source.image : null) : sample;
  const k = boxSize.width && boxSize.height ? Math.min(boxSize.width / original.width, boxSize.height / original.height) : 0;
  const cssW = Math.floor(original.width * k);
  const cssH = Math.floor(original.height * k);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !image || !cssW) return;
    const frame = requestAnimationFrame(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = fitPixels(Math.round(cssW * dpr), Math.round(cssH * dpr), Infinity, PREVIEW_MAX_SIDE);
      if (c.width !== px.width || c.height !== px.height) {
        c.width = px.width;
        c.height = px.height;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const plan = planFor(settings, original, unit, settings.type === "image" ? mark : undefined);
      drawWatermarked(ctx, image, plan, px.width / original.width, markImage && markImage.id === markId ? markImage.image : null);
    });
    return () => cancelAnimationFrame(frame);
  }, [image, cssW, cssH, settings, unit, mark, markImage, markId, original]);

  return (
    <div ref={box} className="relative grid min-h-0 min-w-0 flex-1 place-items-center">
      <canvas
        ref={canvas}
        role="img"
        aria-label={item ? `预览：${item.name}` : "预览：示例图"}
        style={{ width: cssW || undefined, height: cssH || undefined }}
        className={cn("block rounded-xs shadow-float", !image && "invisible")}
      />
    </div>
  );
}

function Thumbs() {
  const { images, currentId, selected, selectMode } = useSession();
  const mobile = useIsMobile();
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);

  function startPress(id: string) {
    const state = { fired: false, timer: setTimeout(() => {
      state.fired = true;
      enterSelectMode(id);
    }, LONG_PRESS_MS) };
    press.current = state;
  }
  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer);
  }

  const multi = images.length > 1;
  const count = selected.length;
  const others = selected.filter((id) => id !== currentId).length;

  return (
    <div className={cn("grid gap-2", mobile ? "order-first" : "")}>
      <ul aria-label="已打开的图片" className="m-0 flex list-none gap-2 overflow-x-auto p-1">
        {images.map((im, i) => {
          const isSelected = selected.includes(im.id);
          return (
            <li key={im.id} className="flex-none">
              <button
                type="button"
                aria-label={`第 ${i + 1} 张：${im.name}`}
                aria-current={im.id === currentId ? "true" : undefined}
                aria-pressed={multi ? isSelected : undefined}
                onPointerDown={(e) => e.pointerType !== "mouse" && startPress(im.id)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (press.current?.fired) {
                    press.current = null;
                    return;
                  }
                  clickImage(im.id, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
                }}
                className={cn(
                  "press focus-ring relative grid size-14 cursor-pointer place-items-center overflow-hidden rounded-sm border-2 bg-surface-raised p-0 select-none [-webkit-touch-callout:none]",
                  im.id === currentId ? "border-sky" : "border-transparent",
                )}
              >
                <img src={im.thumb} alt="" draggable={false} className="size-full object-cover" />
                {isSelected ? (
                  <span aria-hidden className="absolute top-1 right-1 grid size-[18px] place-items-center rounded-full bg-sky text-on-sky shadow-[0_0_0_2px_var(--surface)]">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-1">
        {mobile && multi ? (
          <Button size="sm" variant={selectMode ? "secondary" : "ghost"} onClick={() => (selectMode ? exitSelectMode() : useSession.setState({ selectMode: true }))}>
            {selectMode ? "完成" : "多选"}
          </Button>
        ) : null}
        {multi && (!mobile || selectMode) ? (
          <Button size="sm" variant="ghost" onClick={toggleSelectAll}>
            {count === images.length ? "取消全选" : "全选"}
          </Button>
        ) : null}
        {others ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const n = syncToSelected();
              toast.success(`已把当前设置用到 ${n} 张图`);
            }}
          >
            同步设置
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={resetToDefaults}>
          {count ? `恢复默认（${count} 张）` : "恢复默认"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => removeImages(targets().map((im) => im.id))}>
          {count ? `移除 ${count} 张` : "移除"}
        </Button>
        {count ? <span className="ml-auto px-2 font-num text-timecode text-ink-muted tabular-nums">已选 {count} 张</span> : null}
      </div>
    </div>
  );
}

export function Stage({ item, settings, unit, mark }: { item: ImageItem | null; settings: MarkSettings; unit: SizeUnit; mark: Mark | undefined }) {
  const mobile = useIsMobile();
  const hasImages = useSession((s) => s.images.length > 0);
  return (
    <div className="relative flex size-full min-h-0 flex-col gap-4">
      {mobile && !item ? (
        <Tag className="absolute top-0 left-0 z-1">示例图</Tag>
      ) : null}
      <Preview item={item} settings={settings} unit={unit} mark={mark} />
      {hasImages ? <Thumbs /> : null}
    </div>
  );
}
