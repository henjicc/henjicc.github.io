import { useId, useState } from "react";
import { platform } from "~/platform";
import { toast } from "~/ui/sonner";
import { TextField } from "~/ui/text-field";
import { Textarea } from "~/ui/textarea";
import { hasPlaceholder, PLACEHOLDER, type PromptTemplate } from "./logic/prompt";
import { exportTemplateFile, parseTemplateFile } from "./logic/transfer";
import { EditorForm, LibraryDialog } from "./LibraryDialog";
import { reportSave } from "./platform-io";
import { DEFAULT_TEMPLATE, newId, useLibrary, useSettings } from "./store";

type Draft = Omit<PromptTemplate, "id"> & { id: string | null };

/** 提示词里没有占位符时的提醒：放在用户提示词下面和控制栏里，开始前就能看到。 */
export const NO_PLACEHOLDER = `没有 ${PLACEHOLDER}，文件内容会接在用户提示词后面`;

export function TemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const templates = useLibrary((s) => s.templates);
  const activeId = useSettings((s) => s.activeTemplateId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"name" | "userPrompt", string>>>({});
  const systemId = useId();
  const userId = useId();

  function edit(next: Draft | null) {
    setDraft(next);
    setErrors({});
  }

  function save() {
    if (!draft) return;
    const found = {
      name: draft.name.trim() ? undefined : "起个名字",
      userPrompt: draft.userPrompt.trim() ? undefined : `写上要对文本做什么，用 ${PLACEHOLDER} 标出文本放在哪`,
    };
    setErrors(found);
    if (found.name || found.userPrompt) return;
    const template: PromptTemplate = { ...draft, id: draft.id ?? newId(), name: draft.name.trim() };
    useLibrary.setState((s) => ({
      templates: draft.id ? s.templates.map((t) => (t.id === draft.id ? template : t)) : [...s.templates, template],
    }));
    if (!draft.id) useSettings.setState({ activeTemplateId: template.id });
    edit(null);
    toast.success(draft.id ? "已保存" : "已新建并切换到这个模板");
  }

  function snapshot() {
    return { templates: useLibrary.getState().templates, active: useSettings.getState().activeTemplateId };
  }

  function restore(before: ReturnType<typeof snapshot>) {
    useLibrary.setState({ templates: before.templates });
    useSettings.setState({ activeTemplateId: before.active });
  }

  function remove(template: PromptTemplate) {
    const before = snapshot();
    const rest = before.templates.filter((t) => t.id !== template.id);
    useLibrary.setState({ templates: rest });
    if (before.active === template.id) useSettings.setState({ activeTemplateId: rest[0]?.id ?? "" });
    if (draft?.id === template.id) edit(null);
    toast(`已删除 ${template.name}`, { action: { label: "撤销", onClick: () => restore(before) } });
  }

  function importText(text: string) {
    let imported;
    try {
      imported = parseTemplateFile(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败");
      return;
    }
    const before = snapshot();
    const next = imported.map((t) => ({ ...t, id: newId() }));
    useLibrary.setState({ templates: next });
    useSettings.setState({ activeTemplateId: next[0]!.id });
    edit(null);
    toast.success(`已导入 ${next.length} 个模板，替换了原来的`, { action: { label: "撤销", onClick: () => restore(before) } });
  }

  async function exportFile() {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([exportTemplateFile(templates)], { type: "application/json" });
    reportSave(await platform.saveFile(blob, `prompt-templates-${date}.json`), "已导出模板");
  }

  return (
    <LibraryDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) edit(null);
      }}
      title="提示词模板"
      noun="新建模板"
      entries={templates}
      activeId={activeId}
      onSelect={(id) => useSettings.setState({ activeTemplateId: id })}
      describe={(t) => <span className="truncate">{t.userPrompt.slice(0, 400).replace(/\s+/g, " ")}</span>}
      onEdit={(t) => edit({ ...t })}
      onDelete={remove}
      canDelete={(t) => templates.length > 1 && t.id !== DEFAULT_TEMPLATE.id}
      onNew={() => edit({ id: null, name: "", systemPrompt: DEFAULT_TEMPLATE.systemPrompt, userPrompt: DEFAULT_TEMPLATE.userPrompt })}
      editor={
        draft ? (
          <EditorForm title={draft.id ? "编辑模板" : "新建模板"} onSave={save} onCancel={() => edit(null)}>
            <TextField label="名称" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} error={errors.name} autoFocus />
            <div className="grid gap-2">
              <label htmlFor={systemId} className="text-ui text-ink">
                系统提示词
              </label>
              <Textarea id={systemId} className="min-h-24" value={draft.systemPrompt} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <label htmlFor={userId} className="text-ui text-ink">
                用户提示词
              </label>
              <Textarea
                id={userId}
                aria-invalid={errors.userPrompt ? true : undefined}
                aria-describedby={`${userId}-note`}
                value={draft.userPrompt}
                onChange={(e) => setDraft({ ...draft, userPrompt: e.target.value })}
              />
              <p id={`${userId}-note`} className="m-0 text-caption empty:hidden">
                {errors.userPrompt ? (
                  <span className="text-ember">{errors.userPrompt}</span>
                ) : draft.userPrompt.trim() && !hasPlaceholder(draft.userPrompt) ? (
                  <span className="text-amber">{NO_PLACEHOLDER}</span>
                ) : null}
              </p>
            </div>
          </EditorForm>
        ) : null
      }
      onImport={importText}
      onExport={() => void exportFile()}
    />
  );
}
