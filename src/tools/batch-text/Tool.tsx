import { Download, FilePlus, Play, Settings2, Square, Trash2, X } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { platform } from "~/platform";
import { ControlGroup } from "~/shell/tool/ControlGroup";
import { useStoresHydrated } from "~/shell/tool/persist";
import { ToolShell } from "~/shell/tool/ToolShell";
import { Button } from "~/ui/button";
import { FileDrop } from "~/ui/file-drop";
import { IconButton } from "~/ui/icon-button";
import { cn } from "~/ui/lib/utils";
import { Segmented } from "~/ui/segmented";
import { Slider } from "~/ui/slider";
import { toast } from "~/ui/sonner";
import { Switch } from "~/ui/switch";
import { Tag } from "~/ui/tag";
import { TextField } from "~/ui/text-field";
import { ConfigDialog } from "./ConfigDialog";
import { checkBaseUrl, describeError, ENDPOINT_MESSAGES, isAbort, requestChat, testConnection } from "./logic/api";
import { formatFileSize, isAcceptedTextFile, previewText, resultFileName, timestamp, type ExportFormat } from "./logic/files";
import { runPool } from "./logic/pool";
import { buildMessages, hasPlaceholder } from "./logic/prompt";
import { countByStatus, missingRequirements, retryFailed, stopProcessing, type ItemStatus, type QueueItem } from "./logic/queue";
import meta from "./meta";
import { pageOrigin, reportSave } from "./platform-io";
import { PreviewDialog } from "./PreviewDialog";
import { DEFAULT_SETTINGS, newId, persistedStores, updateItem, useKeys, useLibrary, useSession, useSettings } from "./store";
import { NO_PLACEHOLDER, TemplateDialog } from "./TemplateDialog";

const STATUS: Record<ItemStatus, { label: string; tone: "neutral" | "sky" | "moss" | "ember" }> = {
  pending: { label: "待处理", tone: "neutral" },
  processing: { label: "处理中", tone: "sky" },
  completed: { label: "完成", tone: "moss" },
  error: { label: "失败", tone: "ember" },
};

/** 控制栏里的单选列表：接口配置、提示词模板。 */
function ChoiceList({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (id: string) => void; options: { id: string; name: string; detail: string }[] }) {
  return (
    <RadioGroup.Root aria-label={label} value={value} onValueChange={onValueChange} className="grid gap-1.5">
      {options.map((o) => (
        <RadioGroup.Item
          key={o.id}
          value={o.id}
          className="focus-ring grid cursor-pointer gap-0.5 rounded-sm border border-line bg-surface-raised px-3 py-2 text-left text-ink transition-colors duration-(--dur-quick) ease-out hover:border-line-strong data-[state=checked]:border-sky-line data-[state=checked]:bg-sky-soft"
        >
          <span className="truncate text-ui">{o.name}</span>
          <span className="truncate text-caption text-ink-muted">{o.detail}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

function ItemRow({ item, selected, onSelect, onOpen, onDownload, onRemove, removable }: {
  item: QueueItem;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onOpen: () => void;
  onDownload: () => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const status = STATUS[item.status];
  const done = item.status === "completed";
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 rounded-md border border-line bg-surface px-4 py-3 @2xl:grid-cols-[20px_minmax(0,1fr)_minmax(0,1fr)_auto] @2xl:gap-x-4">
      <input
        type="checkbox"
        aria-label={`选中 ${item.name}`}
        disabled={!done}
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        className="mt-[3px] size-4 cursor-pointer accent-sky disabled:cursor-not-allowed disabled:opacity-40"
      />
      <button type="button" onClick={onOpen} className="focus-ring grid min-w-0 cursor-pointer gap-1 rounded-xs border-0 bg-transparent p-0 text-left text-ink">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-ui">{item.name}</span>
          <span className="flex-none font-num text-micro text-ink-faint tabular-nums">{formatFileSize(item.size)}</span>
        </span>
        <span className="line-clamp-2 text-caption text-ink-muted">{previewText(item.content, 120)}</span>
      </button>
      <div className="col-start-2 row-start-2 min-w-0 text-caption @2xl:col-start-3 @2xl:row-start-1 @2xl:pt-[22px]">
        {item.status === "error" ? (
          <p className="m-0 text-ember [overflow-wrap:anywhere]">{item.error}</p>
        ) : done ? (
          <button type="button" onClick={onOpen} className="focus-ring line-clamp-2 cursor-pointer rounded-xs border-0 bg-transparent p-0 text-left text-ink">
            {previewText(item.result ?? "", 120) || "（空回复）"}
          </button>
        ) : null}
      </div>
      <div className="col-start-3 row-start-1 flex items-center gap-1 @2xl:col-start-4">
        <Tag tone={status.tone}>{status.label}</Tag>
        {done ? <IconButton icon={Download} label={`下载 ${item.name} 的结果`} size="sm" onClick={onDownload} /> : null}
        {removable ? <IconButton icon={X} label={`移除 ${item.name}`} size="sm" onClick={onRemove} /> : null}
      </div>
    </li>
  );
}

export default function BatchText() {
  const ready = useStoresHydrated(persistedStores);
  const { activeConfigId, activeTemplateId, exportFormat } = useSettings();
  const { configs, templates } = useLibrary();
  const { keys, remember } = useKeys();
  const { items, running, runIds, concurrency } = useSession();
  const [configOpen, setConfigOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [testing, setTesting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const config = configs.find((c) => c.id === activeConfigId);
  const template = templates.find((t) => t.id === activeTemplateId);
  const apiKey = (config && keys[config.id]) ?? "";
  const counts = useMemo(() => countByStatus(items), [items]);
  const completed = items.filter((i) => i.status === "completed");
  const chosen = completed.filter((i) => selected.has(i.id));
  const endpointProblem = config ? checkBaseUrl(config.baseUrl, pageOrigin()) : null;
  const runDone = items.filter((i) => runIds.includes(i.id) && (i.status === "completed" || i.status === "error")).length;

  // 离开页面时取消还在跑的请求
  useEffect(() => () => controller.current?.abort(), []);

  async function addFiles(files: File[]) {
    const accepted = files.filter((f) => isAcceptedTextFile(f.name, f.type));
    const skipped = files.length - accepted.length;
    if (!accepted.length) {
      if (files.length) toast.error("只能添加 .txt 和 .md 文本文件");
      return;
    }
    const added: QueueItem[] = await Promise.all(
      accepted.map(async (f) => ({ id: newId(), name: f.name, size: f.size, content: await f.text(), status: "pending" as const })),
    );
    useSession.setState((s) => ({ items: [...s.items, ...added] }));
    toast.success(`已添加 ${added.length} 个文件`, skipped ? { description: `跳过了 ${skipped} 个不是文本的文件` } : undefined);
  }

  async function start() {
    const missing = missingRequirements({ items, config, apiKey, template, pageOrigin: pageOrigin() });
    if (missing.length || !config || !template) {
      toast.warning("还不能开始", { description: missing.join("；") });
      return;
    }
    const ac = new AbortController();
    controller.current = ac;
    const ids = items.filter((i) => i.status === "pending").map((i) => i.id);
    useSession.setState({ running: true, runIds: ids });

    await runPool(
      ids,
      async (id, signal) => {
        const item = useSession.getState().items.find((i) => i.id === id);
        if (!item || item.status !== "pending") return;
        updateItem(id, { status: "processing", error: undefined });
        try {
          const result = await requestChat(fetch, config, apiKey, buildMessages(template, item.content), signal);
          if (!signal.aborted) updateItem(id, { status: "completed", result });
        } catch (e) {
          if (!signal.aborted && !isAbort(e)) updateItem(id, { status: "error", error: describeError(e) });
        }
      },
      { concurrency, signal: ac.signal },
    );

    // 停止时 stop() 已经收拾好了状态
    if (ac.signal.aborted) return;
    controller.current = null;
    useSession.setState({ running: false });
    const finished = useSession.getState().items.filter((i) => ids.includes(i.id));
    const failed = finished.filter((i) => i.status === "error").length;
    const ok = finished.filter((i) => i.status === "completed").length;
    if (failed) toast.warning(`处理完了：成功 ${ok} 条，失败 ${failed} 条`);
    else toast.success(`处理完了：${ok} 条全部成功`);
  }

  function stop() {
    controller.current?.abort();
    controller.current = null;
    useSession.setState((s) => ({ running: false, items: stopProcessing(s.items) }));
    toast("已停止，没处理完的放回了待处理");
  }

  async function checkConnection() {
    if (!config) return;
    if (endpointProblem) {
      toast.error(ENDPOINT_MESSAGES[endpointProblem]);
      return;
    }
    if (!apiKey.trim()) {
      toast.error("先填写接口密钥");
      return;
    }
    setTesting(true);
    try {
      await testConnection(fetch, config, apiKey);
      toast.success("连接成功");
    } catch (e) {
      toast.error("连接失败", { description: describeError(e) });
    } finally {
      setTesting(false);
    }
  }

  async function downloadZip(kind: "result" | "original") {
    const { buildZip } = await import("./logic/zip");
    const files = chosen.map((i) =>
      kind === "result" ? { name: resultFileName(i.name, exportFormat), text: i.result ?? "" } : { name: i.name, text: i.content },
    );
    const blob = new Blob([buildZip(files)], { type: "application/zip" });
    const name = `${kind === "result" ? "处理结果" : "原文"}_${timestamp(new Date())}.zip`;
    reportSave(await platform.saveFile(blob, name), `已下载 ${files.length} 个文件`);
  }

  async function downloadOne(item: QueueItem) {
    const blob = new Blob([item.result ?? ""], { type: "text/plain;charset=utf-8" });
    reportSave(await platform.saveFile(blob, resultFileName(item.name, exportFormat)), "已下载");
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function removeItem(id: string) {
    useSession.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    toggle(id, false);
  }

  function clearAll() {
    const before = useSession.getState().items;
    useSession.setState({ items: [], runIds: [] });
    setSelected(new Set());
    toast("已清空文件", { action: { label: "撤销", onClick: () => useSession.setState({ items: before }) } });
  }

  const onDrag = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      void addFiles(Array.from(e.dataTransfer.files));
    },
  };

  const allChosen = completed.length > 0 && chosen.length === completed.length;
  const percent = runIds.length ? Math.round((runDone / runIds.length) * 100) : 0;

  const stage = items.length ? (
    <div {...onDrag} className="@container grid size-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3 self-stretch justify-self-stretch">
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn("flex items-center gap-2 text-ui", !completed.length && "text-ink-faint")}>
          <input
            type="checkbox"
            disabled={!completed.length}
            checked={allChosen}
            onChange={(e) => setSelected(e.target.checked ? new Set(completed.map((i) => i.id)) : new Set())}
            className="size-4 cursor-pointer accent-sky disabled:cursor-not-allowed disabled:opacity-40"
          />
          全选
        </label>
        <Button size="sm" disabled={!chosen.length} onClick={() => void downloadZip("result")}>
          <Download aria-hidden />
          下载结果{chosen.length ? `（${chosen.length}）` : ""}
        </Button>
        <Button size="sm" variant="ghost" disabled={!chosen.length} onClick={() => void downloadZip("original")}>
          下载原文
        </Button>
        {/* 窄舞台（手机）上只留图标，工具栏保持一行 */}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="@max-xl:w-8 @max-xl:px-0" onClick={() => fileInput.current?.click()}>
            <FilePlus aria-hidden />
            <span className="@max-xl:sr-only">添加文件</span>
          </Button>
          <Button size="sm" variant="ghost" className="@max-xl:w-8 @max-xl:px-0" disabled={running} onClick={clearAll}>
            <Trash2 aria-hidden />
            <span className="@max-xl:sr-only">清空</span>
          </Button>
        </div>
      </div>
      {running ? (
        <div className="grid gap-1.5">
          <div className="flex justify-between font-num text-timecode text-ink-muted tabular-nums">
            <span>
              处理进度 {runDone} / {runIds.length}
            </span>
            <span>{percent}%</span>
          </div>
          <div role="progressbar" aria-label="处理进度" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1 overflow-hidden rounded-xs bg-line">
            <div className="h-full bg-sky transition-[width] duration-(--dur-base) ease-out" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <div />
      )}
      <ul aria-label="文件" className="m-0 grid list-none content-start gap-2 overflow-auto p-0 pb-1">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            selected={selected.has(item.id)}
            onSelect={(on) => toggle(item.id, on)}
            onOpen={() => setPreviewId(item.id)}
            onDownload={() => void downloadOne(item)}
            onRemove={() => removeItem(item.id)}
            removable={item.status !== "processing"}
          />
        ))}
      </ul>
    </div>
  ) : (
    <FileDrop
      className="w-full max-w-[520px] bg-transparent"
      multiple
      accept=".txt,.md,.markdown,text/plain,text/markdown"
      title="把文本文件拖到这里"
      action="选择文件"
      formats="TXT 和 Markdown，可以多选"
      onFiles={(files) => void addFiles(files)}
    />
  );

  const controls = (
    <>
      <ControlGroup title="接口">
        <ChoiceList
          label="接口配置"
          value={activeConfigId}
          onValueChange={(id) => useSettings.setState({ activeConfigId: id })}
          options={configs.map((c) => ({ id: c.id, name: c.name, detail: c.model }))}
        />
        {endpointProblem && endpointProblem !== "empty" ? <p className="m-0 text-caption text-ember">{ENDPOINT_MESSAGES[endpointProblem]}</p> : null}
        <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setConfigOpen(true)}>
          <Settings2 aria-hidden />
          管理接口
        </Button>
        <TextField
          label="接口密钥"
          type="password"
          autoComplete="off"
          spellCheck={false}
          disabled={!config}
          value={apiKey}
          onChange={(v) => config && useKeys.setState((s) => ({ keys: { ...s.keys, [config.id]: v } }))}
        />
        <Switch label="在此设备记住" checked={remember} onCheckedChange={(v) => useKeys.setState({ remember: v })} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={testing || !config} onClick={() => void checkConnection()}>
            {testing ? "正在测试…" : "测试连接"}
          </Button>
          {remember ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                useKeys.setState({ keys: {}, remember: false });
                toast("已清除保存的密钥");
              }}
            >
              清除已保存的密钥
            </Button>
          ) : null}
        </div>
      </ControlGroup>
      <ControlGroup title="提示词">
        <ChoiceList
          label="提示词模板"
          value={activeTemplateId}
          onValueChange={(id) => useSettings.setState({ activeTemplateId: id })}
          options={templates.map((t) => ({ id: t.id, name: t.name, detail: t.userPrompt.replace(/\s+/g, " ") }))}
        />
        {template && !hasPlaceholder(template.userPrompt) ? <p className="m-0 text-caption text-amber">{NO_PLACEHOLDER}</p> : null}
        <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setTemplateOpen(true)}>
          <Settings2 aria-hidden />
          管理模板
        </Button>
      </ControlGroup>
      <ControlGroup title="运行">
        <Slider
          label="同时处理"
          min={1}
          max={5}
          unit=" 个"
          value={concurrency}
          disabled={running}
          onValueChange={(v) => useSession.setState({ concurrency: v })}
        />
        <div className="grid gap-2">
          <span aria-hidden className="text-ui text-ink">
            结果文件格式
          </span>
          <Segmented<ExportFormat>
            label="结果文件格式"
            block
            value={exportFormat}
            onValueChange={(v) => useSettings.setState({ exportFormat: v })}
            options={[
              { value: "txt", label: "TXT" },
              { value: "md", label: "Markdown" },
            ]}
          />
        </div>
      </ControlGroup>
    </>
  );

  const summary = running
    ? `处理中 ${runDone}/${runIds.length} · 失败 ${counts.error}`
    : !apiKey.trim()
      ? "还没填写接口密钥"
      : [config?.name, config?.model, template?.name, `${counts.pending} 个待处理`].filter(Boolean).join(" · ");

  return (
    <>
      <ToolShell
        tool={meta}
        ready={ready}
        controls={controls}
        summary={summary}
        stage={stage}
        dragOver={dragOver}
        status={
          <>
            <span>待处理 {counts.pending}</span>
            <span>处理中 {counts.processing}</span>
            <span>完成 {counts.completed}</span>
            <span>失败 {counts.error}</span>
          </>
        }
        actions={
          counts.error && !running ? (
            <Button variant="ghost" onClick={() => useSession.setState((s) => ({ items: retryFailed(s.items) }))}>
              重试失败
            </Button>
          ) : null
        }
        primary={{ label: running ? "停止" : "开始处理", icon: running ? Square : Play, onClick: running ? stop : () => void start() }}
        onReset={() => {
          // 只恢复运行设置；配置、模板和密钥是用户的数据，不跟着清掉
          useSettings.setState({ exportFormat: DEFAULT_SETTINGS.exportFormat });
          if (!running) useSession.setState({ concurrency: 1 });
          toast("已恢复默认");
        }}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        multiple
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <ConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
      <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} />
      <PreviewDialog item={items.find((i) => i.id === previewId) ?? null} format={exportFormat} onClose={() => setPreviewId(null)} />
    </>
  );
}
