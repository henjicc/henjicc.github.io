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
import { addFiles, resetToDefaults, targets, toggleSelectAll } from "./actions";
import { Controls } from "./Controls";
import { exportImages } from "./exporter";
import { isHeic } from "./logic/output";
import { summarize } from "./logic/settings";
import meta from "./meta";
import { Stage } from "./Stage";
import { persistedStores, useApp, useDraft, useLibrary, useSession } from "./store";

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
  const fileInput = useRef<HTMLInputElement>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const current = images.find((im) => im.id === currentId) ?? null;
  const count = selected.length || (current ? 1 : 0);
  const toy = platform.kind === "toy";

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  async function runExport() {
    const items = targets();
    if (!items.length || progress) return;
    setProgress({ done: 0, total: items.length });
    try {
      const r = await exportImages(items, useApp.getState(), useLibrary.getState().marks, (n) => setProgress({ done: n, total: items.length }));
      if (r.kind === "saved") toast.success(r.count === 1 ? "已存到相册" : `已存 ${r.count} 张到相册`);
      if (r.kind === "shown") toast("这里存不了相册，长按图片保存");
      if (r.kind === "downloaded") {
        setDone(true);
        clearTimeout(doneTimer.current);
        doneTimer.current = setTimeout(() => setDone(false), DONE_MS);
      }
      if (r.scaled) toast(r.scaled === 1 && r.count === 1 ? "图片太大，已按比例缩小后导出" : `有 ${r.scaled} 张图太大，已按比例缩小后导出`);
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
  const exportRef = useRef(runExport);
  useEffect(() => {
    exportRef.current = runExport;
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
          resetToDefaults();
          toast("已恢复默认");
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
