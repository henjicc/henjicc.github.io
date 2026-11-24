import { Download, FolderOpen, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { platform } from "~/platform";
import { useIsMobile } from "~/shell/media";
import { useStoresHydrated } from "~/shell/tool/persist";
import { ToolShell } from "~/shell/tool/ToolShell";
import { Button } from "~/ui/button";
import { IconButton } from "~/ui/icon-button";
import { toast } from "~/ui/sonner";
import { Tag } from "~/ui/tag";
import { addFiles, factoryReset, isFactoryApp, resetToDefaults, targets, toggleSelectAll } from "./actions";
import { Controls } from "./Controls";
import { exportImages, missingMark, type ExportOutcome } from "./exporter";
import { isHeic } from "./logic/output";
import { summarize } from "./logic/settings";
import meta from "./meta";
import { Stage } from "./Stage";
import { persistedStores, useApp, useDraft, useLibrary, useSession, type ImageItem } from "./store";

const DONE_MS = 1200;
const IMAGE_ACCEPT = "image/*,.heic,.heif";

function isImageFile(f: File) {
  return f.type.startsWith("image/") || isHeic(f.type, f.name);
}

function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

async function openFiles(files: readonly File[]) {
  const images = files.filter(isImageFile);
  if (!images.length) {
    if (files.length) toast.error("只能打开图片文件");
    return;
  }
  const r = await addFiles(images);
  if (r.failed.length) toast.error(r.failed.length === 1 ? `这张图打不开：${r.failed[0]}，换一张试试` : `有 ${r.failed.length} 张图打不开，换成 JPG 或 PNG 再试`);
}

/** 当前要导出哪几张：选择或当前图变了，之前没存上的那批就不再算数。 */
function targetKey() {
  return targets()
    .map((im) => im.id)
    .join(",");
}

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
}

export default function Watermark() {
  const ready = useStoresHydrated(persistedStores);
  const mobile = useIsMobile();
  const settings = useDraft((d) => d.current);
  const unit = useApp((a) => a.unit);
  const { images, currentId, selected } = useSession();
  const mark = useLibrary((l) => (settings.markId ? l.marks[settings.markId] : undefined));
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  /**
   * TOY 批量存相册时没存上的图。主按钮换成“重试没存上的 N 张”，只存这几张，已存进相册的不会再存一遍。
   * 不放在提示的按钮里：提示几秒就消失，而且平台层弹出的“长按图片保存”会盖住它。换了要导出的图就作废。
   */
  const [retry, setRetry] = useState<{ ids: string[]; key: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const current = images.find((im) => im.id === currentId) ?? null;
  const count = selected.length || (current ? 1 : 0);
  const toy = platform.kind === "toy";
  const retryItems = retry && retry.key === targetKey() ? images.filter((im) => retry.ids.includes(im.id)) : [];

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  /**
   * retrying：这一轮是在重试上一轮没存上的图。重试轮里哪怕只剩一张，同批的其他图也已经在相册里了，
   * 失败后必须继续给出重试按钮；否则主按钮回到“存 N 张到相册”，再点会把已存的图又存一遍。
   */
  function reportAlbum(r: Extract<ExportOutcome, { kind: "album" }>, total: number, retrying: boolean) {
    if (!r.failed.length) {
      toast.success(r.saved.length === 1 ? "已存到相册" : `已存 ${r.saved.length} 张到相册`);
      return;
    }
    if (r.shown && !r.saved.length) {
      if (retrying) setRetry({ ids: r.failed, key: targetKey() });
      toast("这里存不了相册，长按图片保存");
      return;
    }
    if (total === 1 && !retrying) {
      toast.error(r.error instanceof Error && /[一-龥]/.test(r.error.message) ? r.error.message : "没存上，再试一次");
      return;
    }
    setRetry({ ids: r.failed, key: targetKey() });
    toast.error(r.saved.length ? `已存 ${r.saved.length} 张，${r.failed.length} 张没存上` : total === 1 ? "这张还是没存上" : `${r.failed.length} 张都没存上`);
  }

  async function runExport(only?: readonly ImageItem[]) {
    const items = only ?? targets();
    if (!items.length || progress) return;
    setRetry(null);
    const marks = useLibrary.getState().marks;
    const noMark = missingMark(items, marks);
    if (noMark.length) {
      toast.error(items.length === 1 ? "还没选水印图片，选一张再导出" : `有 ${noMark.length} 张还没选水印图片，选好再导出`);
      return;
    }
    setProgress({ done: 0, total: items.length });
    try {
      const r = await exportImages(items, useApp.getState(), marks, (n) => setProgress({ done: n, total: items.length }));
      if (r.kind === "album") reportAlbum(r, items.length, only !== undefined);
      if (r.kind === "downloaded") {
        setDone(true);
        clearTimeout(doneTimer.current);
        doneTimer.current = setTimeout(() => setDone(false), DONE_MS);
      }
      const count = r.kind === "album" ? r.saved.length : r.count;
      if (r.scaled) toast(r.scaled === 1 && count === 1 ? "图片太大，已按比例缩小后导出" : `有 ${r.scaled} 张图太大，已按比例缩小后导出`);
    } catch (error) {
      toast.error(error instanceof Error && /[一-龥]/.test(error.message) ? error.message : "导出失败，再试一次");
    } finally {
      setProgress(null);
    }
  }

  // 整页接受拖放和粘贴图片
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragOver(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(false);
      void openFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    const paste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(isImageFile);
      if (!files.length) return;
      e.preventDefault();
      void openFiles(files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, []);

  // Ctrl/⌘ S 导出，Ctrl/⌘ A 全选或取消全选；焦点在输入框里时交给浏览器
  const exportRef = useRef(() => runExport());
  useEffect(() => {
    exportRef.current = () => runExport(retryItems.length ? retryItems : undefined);
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isEditable(e.target)) return;
      if (document.querySelector("[role='dialog'][data-state='open']")) return;
      const key = e.key.toLowerCase();
      if (key === "s" && useSession.getState().images.length) {
        e.preventDefault();
        void exportRef.current();
      } else if (key === "a" && useSession.getState().images.length > 1) {
        e.preventDefault();
        toggleSelectAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exportLabel = toy ? (count > 1 ? `存 ${count} 张到相册` : "存到相册") : count > 1 ? `导出 ${count} 张` : "导出图片";
  const primary = !images.length
    ? { label: "打开图片", icon: FolderOpen, onClick: () => fileInput.current?.click() }
    : progress
      ? { label: toy ? `已存 ${progress.done}/${progress.total}` : `正在导出 ${progress.done}/${progress.total}`, icon: Download, onClick: () => {}, disabled: true }
      : retryItems.length
        ? { label: `重试没存上的 ${retryItems.length} 张`, icon: Download, onClick: () => void runExport(retryItems) }
        : { label: done ? "已导出" : exportLabel, icon: Download, onClick: () => void runExport(), done };

  const addButton = images.length ? (
    mobile ? (
      <IconButton icon={ImagePlus} label="添加图片" size="lg" variant="secondary" onClick={() => fileInput.current?.click()} />
    ) : (
      <Button onClick={() => fileInput.current?.click()}>
        <ImagePlus aria-hidden />
        添加图片
      </Button>
    )
  ) : null;

  return (
    <>
      <ToolShell
        tool={meta}
        ready={ready}
        immersive
        dragOver={dragOver}
        controls={<Controls settings={settings} />}
        summary={summarize(settings, mark?.name, images.length)}
        stage={<Stage item={current} settings={settings} unit={unit} mark={mark} />}
        status={
          current ? (
            <>
              <span className="max-w-[16ch] truncate">{current.name}</span>
              <span>
                {current.width} × {current.height}
              </span>
              <span>{formatBytes(current.size)}</span>
              {images.length > 1 ? <span>共 {images.length} 张</span> : null}
            </>
          ) : (
            <>
              <Tag>示例图</Tag>
              <span>1600 × 1000</span>
            </>
          )
        }
        actions={addButton}
        primary={primary}
        onReset={() => {
          const n = resetToDefaults();
          // 出厂设置不单独占一个按钮：默认改过时，从这条提示里还能一步回到出厂值
          const app = useApp.getState();
          toast(n > 1 ? `已把 ${n} 张恢复默认` : "已恢复默认", {
            action: isFactoryApp(app)
              ? undefined
              : {
                  label: "恢复出厂设置",
                  onClick: () => {
                    const undo = factoryReset();
                    toast("已恢复出厂设置", { action: { label: "撤销", onClick: undo } });
                  },
                },
          });
        }}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        multiple
        accept={IMAGE_ACCEPT}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void openFiles(files);
        }}
      />
    </>
  );
}
