import { Copy, Download } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { platform } from "~/platform";
import { Button } from "~/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/dialog";
import { Segmented } from "~/ui/segmented";
import { resultFileName, type ExportFormat } from "./logic/files";
import type { QueueItem } from "./logic/queue";
import { reportCopy, reportSave } from "./platform-io";

// react-markdown 和 remark-gfm 只在切到 Markdown 显示时才下载
const Markdown = lazy(() => import("./Markdown"));

type Side = "result" | "original";
type View = "text" | "markdown";

export function PreviewDialog({ item, format, onClose }: { item: QueueItem | null; format: ExportFormat; onClose: () => void }) {
  const [side, setSide] = useState<Side>("result");
  const [view, setView] = useState<View>("text");
  const body = useRef<HTMLDivElement>(null);
  const hasResult = item?.status === "completed";
  const shown: Side = hasResult ? side : "original";
  const text = (shown === "result" ? item?.result : item?.content) ?? "";

  async function download() {
    if (!item) return;
    const name = shown === "result" ? resultFileName(item.name, format) : item.name;
    reportSave(await platform.saveFile(new Blob([text], { type: "text/plain;charset=utf-8" }), name), "已下载");
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-32px)] w-[min(820px,calc(100%-32px))] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden"
      >
        <DialogTitle className="truncate pr-10">{item?.name}</DialogTitle>
        <div className="flex flex-wrap gap-2">
          {hasResult ? (
            <Segmented<Side>
              label="内容"
              value={side}
              onValueChange={setSide}
              options={[
                { value: "result", label: "结果" },
                { value: "original", label: "原文" },
              ]}
            />
          ) : null}
          <Segmented<View>
            label="显示方式"
            value={view}
            onValueChange={setView}
            options={[
              { value: "text", label: "纯文本" },
              { value: "markdown", label: "Markdown" },
            ]}
          />
        </div>
        <div ref={body} className="min-h-40 overflow-auto rounded-md bg-surface-sunken p-4">
          {view === "markdown" ? (
            <Suspense fallback={<p className="m-0 text-caption text-ink-muted">正在加载…</p>}>
              <Markdown text={text} />
            </Suspense>
          ) : (
            <pre className="m-0 font-sans text-body whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{text}</pre>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={async () => reportCopy(await platform.copyText(text, body.current))}>
            <Copy aria-hidden />
            复制
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void download()}>
            <Download aria-hidden />
            下载
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
