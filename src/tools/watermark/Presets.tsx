import { Download, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { platform } from "~/platform";
import { ControlGroup } from "~/shell/tool/ControlGroup";
import { Button } from "~/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/dialog";
import { IconButton } from "~/ui/icon-button";
import { toast } from "~/ui/sonner";
import { TextField } from "~/ui/text-field";
import { Textarea } from "~/ui/textarea";
import { deletePreset, importPresetText, loadPreset, savePreset } from "./actions";
import { exportPresets, LibraryFullError, PresetImportError } from "./logic/presets";
import { useLibrary } from "./store";

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function importText(text: string): Promise<boolean> {
  try {
    const n = await importPresetText(text);
    toast.success(`已导入 ${n} 个预设`);
    return true;
  } catch (error) {
    if (error instanceof LibraryFullError) toast.error(`没导入：${error.message}`);
    else toast.error(error instanceof PresetImportError ? `${error.message}，换一个试试` : "导入失败，换一个试试");
    return false;
  }
}

/** 存预设、撤销删除这类写预设库的操作出错时的提示。 */
export function libraryError(error: unknown, what: string) {
  toast.error(error instanceof LibraryFullError ? `${what}：${error.message}` : `${what}，再试一次`);
}

function SaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>保存为预设</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const saved = name.trim();
            onOpenChange(false);
            savePreset(saved).then(
              () => {
                toast.success(`已保存预设“${saved}”`);
                setName("");
              },
              (error: unknown) => libraryError(error, "预设没存上"),
            );
          }}
        >
          <TextField label="预设名称" value={name} onChange={setName} maxLength={60} autoFocus />
          <Button type="submit" variant="primary" disabled={!name.trim()} className="justify-self-end">
            保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** TOY 里下载和选 JSON 文件都不可行，改成粘贴“预设代码”。 */
function PasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>粘贴预设代码</DialogTitle>
        <Textarea aria-label="预设代码" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-32" />
        <Button
          variant="primary"
          disabled={!text.trim()}
          className="justify-self-end"
          onClick={() => {
            void importText(text).then((ok) => {
              if (!ok) return;
              setText("");
              onOpenChange(false);
            });
          }}
        >
          导入
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** 复制失败时（TOY 里剪贴板被拒、execCommand 也不行）把代码放进文本框选中，让用户长按复制。 */
function CopyDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  return (
    <Dialog open={code !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>长按复制预设代码</DialogTitle>
        <Textarea aria-label="预设代码" readOnly value={code ?? ""} onFocus={(e) => e.currentTarget.select()} autoFocus className="min-h-32" />
      </DialogContent>
    </Dialog>
  );
}

export function Presets() {
  const { presets, marks } = useLibrary();
  const [saving, setSaving] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const toy = platform.kind === "toy";

  async function exportAll() {
    const json = exportPresets(presets, marks);
    if (!toy) {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      await platform.saveFile(new Blob([json], { type: "application/json" }), `watermark-presets-${date}.json`);
      return;
    }
    const result = await platform.copyText(json);
    if (result === "copied") toast.success("已复制预设代码");
    else setCopyFallback(json);
  }

  return (
    <ControlGroup title="预设">
      {presets.length ? (
        <ul className="m-0 grid list-none gap-1 p-0">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  loadPreset(p.id);
                  toast(`已套用“${p.name}”`);
                }}
                className="press focus-ring flex min-h-11 min-w-0 flex-1 cursor-pointer items-baseline gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-ink hover:bg-surface-raised"
              >
                <span className="truncate text-ui">{p.name}</span>
                <span className="ml-auto flex-none font-num text-timecode text-ink-muted tabular-nums">{formatDate(p.createdAt)}</span>
              </button>
              <IconButton
                icon={Trash2}
                label={`删除预设“${p.name}”`}
                size="sm"
                onClick={() => {
                  const undo = deletePreset(p.id);
                  toast(`已删除“${p.name}”`, { action: { label: "撤销", onClick: () => void undo().catch((error: unknown) => libraryError(error, "没撤销成功")) } });
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setSaving(true)}>
          <Plus aria-hidden />
          保存当前设置
        </Button>
        <Button size="sm" variant="ghost" onClick={() => (toy ? setPasting(true) : file.current?.click())}>
          <Upload aria-hidden />
          {toy ? "粘贴预设代码" : "导入"}
        </Button>
        {presets.length ? (
          <Button size="sm" variant="ghost" onClick={() => void exportAll()}>
            <Download aria-hidden />
            {toy ? "复制预设代码" : "导出"}
          </Button>
        ) : null}
      </div>
      <input
        ref={file}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) await importText(await f.text());
        }}
      />
      <SaveDialog open={saving} onOpenChange={setSaving} />
      <PasteDialog open={pasting} onOpenChange={setPasting} />
      <CopyDialog code={copyFallback} onClose={() => setCopyFallback(null)} />
    </ControlGroup>
  );
}
