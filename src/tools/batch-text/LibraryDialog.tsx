import { FileDown, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "~/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/dialog";
import { IconButton } from "~/ui/icon-button";
import { cn } from "~/ui/lib/utils";
import { toast } from "~/ui/sonner";
import { Tag } from "~/ui/tag";

type Entry = { id: string; name: string };

type LibraryDialogProps<T extends Entry> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 用在按钮上：“新建配置”“新建模板”。 */
  noun: string;
  entries: readonly T[];
  activeId: string;
  onSelect: (id: string) => void;
  describe: (entry: T) => ReactNode;
  onEdit: (entry: T) => void;
  onDelete: (entry: T) => void;
  canDelete: (entry: T) => boolean;
  onNew: () => void;
  /** 正在编辑时的表单，显示在列表下面。 */
  editor: ReactNode;
  onImport: (text: string) => void;
  onExport: () => void;
  /** 导出按钮旁边的选项（接口配置的“包含密钥”）。 */
  exportOptions?: ReactNode;
};

const FILE_LIMIT = 1024 * 1024;

/** 接口配置和提示词模板共用的管理弹窗：列表（点选切换）、编辑表单、新建、导入导出。 */
export function LibraryDialog<T extends Entry>(p: LibraryDialogProps<T>) {
  const file = useRef<HTMLInputElement>(null);

  async function importFile(f: File | undefined) {
    if (!f) return;
    if (f.size > FILE_LIMIT) {
      toast.error("这个文件超过 1MB，不像是导出的配置文件");
      return;
    }
    p.onImport(await f.text());
  }

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-32px)] w-[min(640px,calc(100%-32px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
        <DialogTitle className="px-6 pt-6">{p.title}</DialogTitle>
        <div className="grid min-h-0 content-start gap-5 overflow-auto px-6">
          <ul role="list" className="m-0 grid list-none gap-2 p-0">
            {p.entries.map((entry) => {
              const active = entry.id === p.activeId;
              return (
                <li
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-surface-raised py-2 pr-2 pl-4",
                    active ? "border-sky-line" : "border-line",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => p.onSelect(entry.id)}
                    className="focus-ring grid min-w-0 flex-1 cursor-pointer gap-0.5 rounded-sm border-0 bg-transparent p-0 text-left text-ink"
                  >
                    <span className="flex items-center gap-2 text-ui">
                      <span className="truncate">{entry.name}</span>
                      {active ? <Tag tone="sky">正在用</Tag> : null}
                    </span>
                    <span className="truncate text-caption text-ink-muted">{p.describe(entry)}</span>
                  </button>
                  <IconButton icon={Pencil} label={`编辑 ${entry.name}`} size="sm" onClick={() => p.onEdit(entry)} />
                  {p.canDelete(entry) ? (
                    <IconButton icon={Trash2} label={`删除 ${entry.name}`} size="sm" onClick={() => p.onDelete(entry)} />
                  ) : null}
                </li>
              );
            })}
          </ul>
          {p.editor}
        </div>
        <div className="grid gap-3 border-t border-line px-6 py-4">
          {p.exportOptions}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={p.onNew}>
              <Plus aria-hidden />
              {p.noun}
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => file.current?.click()}>
              <FileUp aria-hidden />
              导入
            </Button>
            <Button size="sm" variant="ghost" onClick={p.onExport}>
              <FileDown aria-hidden />
              导出
            </Button>
            <input
              ref={file}
              type="file"
              hidden
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 编辑表单的外框和保存 / 取消。 */
export function EditorForm({ title, children, onSave, onCancel }: { title: string; children: ReactNode; onSave: () => void; onCancel: () => void }) {
  return (
    <form
      className="grid gap-4 border-t border-line pt-5 pb-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h3 className="m-0 text-caption font-semibold text-ink-muted">{title}</h3>
      {children}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary">
          保存
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  );
}
