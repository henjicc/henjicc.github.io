import { useState } from "react";
import { platform } from "~/platform";
import { toast } from "~/ui/sonner";
import { Switch } from "~/ui/switch";
import { TextField } from "~/ui/text-field";
import { checkBaseUrl, ENDPOINT_MESSAGES, normalizeBaseUrl, type ApiConfig } from "./logic/api";
import { exportConfigFile, parseConfigFile } from "./logic/transfer";
import { EditorForm, LibraryDialog } from "./LibraryDialog";
import { pageOrigin, reportSave } from "./platform-io";
import { DEFAULT_CONFIG, newId, useKeys, useLibrary, useSettings } from "./store";

type Draft = Omit<ApiConfig, "id"> & { id: string | null };

export function ConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const configs = useLibrary((s) => s.configs);
  const activeId = useSettings((s) => s.activeConfigId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"name" | "baseUrl" | "model", string>>>({});
  const [includeKeys, setIncludeKeys] = useState(false);

  function edit(next: Draft | null) {
    setDraft(next);
    setErrors({});
  }

  function save() {
    if (!draft) return;
    const baseUrl = normalizeBaseUrl(draft.baseUrl);
    const problem = checkBaseUrl(baseUrl, pageOrigin());
    const found = {
      name: draft.name.trim() ? undefined : "起个名字",
      baseUrl: problem ? ENDPOINT_MESSAGES[problem] : undefined,
      model: draft.model.trim() ? undefined : "填上模型名，如 deepseek-chat",
    };
    setErrors(found);
    if (found.name || found.model || problem) return;
    const config: ApiConfig = { id: draft.id ?? newId(), name: draft.name.trim(), baseUrl, model: draft.model.trim() };
    useLibrary.setState((s) => ({
      configs: draft.id ? s.configs.map((c) => (c.id === draft.id ? config : c)) : [...s.configs, config],
    }));
    if (!draft.id) useSettings.setState({ activeConfigId: config.id });
    edit(null);
    toast.success(draft.id ? "已保存" : "已新建并切换到这套配置");
  }

  function remove(config: ApiConfig) {
    const before = { library: useLibrary.getState().configs, active: useSettings.getState().activeConfigId, keys: useKeys.getState().keys };
    const rest = before.library.filter((c) => c.id !== config.id);
    const keys = { ...before.keys };
    delete keys[config.id];
    useLibrary.setState({ configs: rest });
    useKeys.setState({ keys });
    if (before.active === config.id) useSettings.setState({ activeConfigId: rest[0]?.id ?? "" });
    if (draft?.id === config.id) edit(null);
    toast(`已删除 ${config.name}`, {
      action: {
        label: "撤销",
        onClick: () => {
          useLibrary.setState({ configs: before.library });
          useKeys.setState({ keys: before.keys });
          useSettings.setState({ activeConfigId: before.active });
        },
      },
    });
  }

  function importText(text: string) {
    let imported;
    try {
      imported = parseConfigFile(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败");
      return;
    }
    const before = { library: useLibrary.getState().configs, active: useSettings.getState().activeConfigId, keys: useKeys.getState().keys };
    const next: ApiConfig[] = imported.map((c) => ({ id: newId(), name: c.name, baseUrl: c.baseUrl, model: c.model }));
    const keys: Record<string, string> = {};
    imported.forEach((c, i) => {
      if (c.apiKey) keys[next[i]!.id] = c.apiKey;
    });
    useLibrary.setState({ configs: next });
    useKeys.setState({ keys });
    useSettings.setState({ activeConfigId: next[0]!.id });
    edit(null);
    // 导入会替换全部配置；轻提示里给一次撤销，所以不先弹确认
    toast.success(`已导入 ${next.length} 套配置，替换了原来的`, {
      action: {
        label: "撤销",
        onClick: () => {
          useLibrary.setState({ configs: before.library });
          useKeys.setState({ keys: before.keys });
          useSettings.setState({ activeConfigId: before.active });
        },
      },
    });
  }

  async function exportFile() {
    const json = exportConfigFile(configs, useKeys.getState().keys, includeKeys);
    const date = new Date().toISOString().slice(0, 10);
    reportSave(await platform.saveFile(new Blob([json], { type: "application/json" }), `api-configs-${date}.json`), "已导出配置");
  }

  return (
    <LibraryDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          edit(null);
          setIncludeKeys(false);
        }
      }}
      title="接口配置"
      noun="新建配置"
      entries={configs}
      activeId={activeId}
      onSelect={(id) => useSettings.setState({ activeConfigId: id })}
      describe={(c) => `${c.baseUrl} · ${c.model}`}
      onEdit={(c) => edit({ ...c })}
      onDelete={remove}
      canDelete={(c) => configs.length > 1 && c.id !== DEFAULT_CONFIG.id}
      onNew={() => edit({ id: null, name: "", baseUrl: DEFAULT_CONFIG.baseUrl, model: DEFAULT_CONFIG.model })}
      editor={
        draft ? (
          <EditorForm title={draft.id ? "编辑配置" : "新建配置"} onSave={save} onCancel={() => edit(null)}>
            <TextField label="名称" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} error={errors.name} autoFocus />
            <TextField
              label="接口地址"
              inputMode="url"
              spellCheck={false}
              value={draft.baseUrl}
              onChange={(v) => setDraft({ ...draft, baseUrl: v })}
              error={errors.baseUrl}
            />
            <TextField label="模型" spellCheck={false} value={draft.model} onChange={(v) => setDraft({ ...draft, model: v })} error={errors.model} />
          </EditorForm>
        ) : null
      }
      onImport={importText}
      onExport={() => void exportFile()}
      exportOptions={
        <div className="grid gap-1">
          <Switch label="导出文件包含密钥" checked={includeKeys} onCheckedChange={setIncludeKeys} />
          {includeKeys ? <p className="m-0 text-caption text-amber">文件里的密钥是明文，不要发给别人</p> : null}
        </div>
      }
    />
  );
}
