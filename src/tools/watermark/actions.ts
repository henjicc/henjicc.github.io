// 改状态的操作：界面只调这些，不直接拼 store 的结构。
import { createPreset, importPresets, pruneMarks, type Mark } from "./logic/presets";
import { clickSelect, targetIds } from "./logic/selection";
import { clampSize, FACTORY_APP, filenameAsText, type MarkSettings, type SizeUnit } from "./logic/settings";
import { readImage, readMarkImage } from "./image";
import { useApp, useDraft, useLibrary, useSession, type ImageItem } from "./store";

export const newId = () => crypto.randomUUID();

/** 改面板上的设置：同时写进当前图片。 */
export function updateSettings(next: MarkSettings | ((s: MarkSettings) => MarkSettings)) {
  const current = typeof next === "function" ? next(useDraft.getState().current) : next;
  useDraft.setState({ current });
  const { currentId, images } = useSession.getState();
  if (currentId) useSession.setState({ images: images.map((im) => (im.id === currentId ? { ...im, settings: current } : im)) });
}

export function patchSettings(patch: Partial<MarkSettings>) {
  updateSettings((s) => ({ ...s, ...patch }));
}

export function setUnit(unit: SizeUnit) {
  useApp.setState({ unit });
  patchSettings({ size: clampSize(useDraft.getState().current.size, unit) });
}

function showImage(image: ImageItem | undefined) {
  useSession.setState({ currentId: image?.id ?? null });
  if (image) useDraft.setState({ current: image.settings });
}

export function clickImage(id: string, mods: { toggle?: boolean; range?: boolean }) {
  const s = useSession.getState();
  const ids = s.images.map((im) => im.id);
  const toggle = mods.toggle || s.selectMode;
  const next = clickSelect(ids, s, id, { ...mods, toggle });
  useSession.setState({ selected: next.selected, anchor: next.anchor });
  // 多选只加减选择；普通单击才换当前图
  if (!toggle && !mods.range) showImage(s.images.find((im) => im.id === id));
}

export function enterSelectMode(id: string) {
  const s = useSession.getState();
  useSession.setState({ selectMode: true, selected: s.selected.includes(id) ? s.selected : [...s.selected, id], anchor: id });
}

export function exitSelectMode() {
  useSession.setState({ selectMode: false, selected: [] });
}

export function toggleSelectAll() {
  const s = useSession.getState();
  const all = s.selected.length === s.images.length;
  useSession.setState({ selected: all ? [] : s.images.map((im) => im.id) });
}

export function targets(): ImageItem[] {
  const s = useSession.getState();
  const ids = targetIds(
    s.images.map((im) => im.id),
    s.selected,
    s.currentId,
  );
  return s.images.filter((im) => ids.includes(im.id));
}

/** 读入图片：每张复制一份当前设置；开了“用文件名作水印”时文字换成文件名。返回读不出来的文件名。 */
export async function addFiles(files: readonly File[]): Promise<{ added: number; failed: string[] }> {
  const failed: string[] = [];
  const added: ImageItem[] = [];
  const { useFilename } = useApp.getState();
  for (const file of files) {
    try {
      const r = await readImage(file);
      const base = useDraft.getState().current;
      added.push({
        id: newId(),
        name: file.name || "image",
        mime: file.type,
        size: file.size,
        original: file,
        ...r,
        settings: useFilename ? { ...base, text: filenameAsText(file.name) } : base,
      });
    } catch {
      failed.push(file.name || "图片");
    }
  }
  if (added.length) {
    useSession.setState((s) => ({ images: [...s.images, ...added] }));
    showImage(added[added.length - 1]);
  }
  return { added: added.length, failed };
}

export function removeImages(ids: readonly string[]) {
  const s = useSession.getState();
  const removed = s.images.filter((im) => ids.includes(im.id));
  removed.forEach((im) => URL.revokeObjectURL(im.thumb));
  const images = s.images.filter((im) => !ids.includes(im.id));
  let currentId = s.currentId;
  if (currentId && ids.includes(currentId)) {
    const index = s.images.findIndex((im) => im.id === currentId);
    currentId = (images[Math.min(index, images.length - 1)] ?? null)?.id ?? null;
  }
  useSession.setState({ images, selected: s.selected.filter((id) => !ids.includes(id)), selectMode: images.length > 1 && s.selectMode });
  showImage(images.find((im) => im.id === currentId));
}

/**
 * 把当前设置复制给选中的图。开了“用文件名作水印”时保留各自的文字（文件名），否则会全变成当前这张的名字。
 */
export function syncToSelected(): number {
  const s = useSession.getState();
  const current = useDraft.getState().current;
  const { useFilename } = useApp.getState();
  const ids = s.selected.filter((id) => id !== s.currentId);
  useSession.setState({
    images: s.images.map((im) => (ids.includes(im.id) ? { ...im, settings: useFilename ? { ...current, text: im.settings.text } : current } : im)),
  });
  return ids.length;
}

/** 恢复成默认设置（“设为默认”存下的那套）：有多选时作用于选中的图，否则当前图。 */
export function resetToDefaults() {
  const defaults = useApp.getState().defaults;
  const ids = targets().map((im) => im.id);
  const s = useSession.getState();
  useSession.setState({ images: s.images.map((im) => (ids.includes(im.id) ? { ...im, settings: defaults } : im)) });
  if (!s.currentId || ids.includes(s.currentId)) useDraft.setState({ current: defaults });
}

export function saveAsDefaults() {
  useApp.setState({ defaults: useDraft.getState().current });
}

export function factoryReset() {
  useApp.setState({ ...FACTORY_APP });
}

function marksInUse(): (string | null)[] {
  return [
    useDraft.getState().current.markId,
    useApp.getState().defaults.markId,
    ...useSession.getState().images.map((im) => im.settings.markId),
    ...useLibrary.getState().presets.map((p) => p.settings.markId),
  ];
}

function addMarks(added: readonly Mark[]) {
  const marks = { ...useLibrary.getState().marks };
  for (const m of added) marks[m.id] = m;
  useLibrary.setState({ marks: pruneMarks(marks, [...marksInUse(), ...added.map((m) => m.id)]) });
}

export async function chooseMarkImage(file: File) {
  const mark = await readMarkImage(file, newId());
  addMarks([mark]);
  patchSettings({ type: "image", markId: mark.id });
}

export function savePreset(name: string) {
  const preset = createPreset(name, useDraft.getState().current, newId(), new Date());
  useLibrary.setState((l) => ({ presets: [...l.presets, preset] }));
}

export function loadPreset(id: string) {
  const preset = useLibrary.getState().presets.find((p) => p.id === id);
  if (preset) updateSettings({ ...preset.settings, size: clampSize(preset.settings.size, useApp.getState().unit) });
}

export function deletePreset(id: string) {
  const before = useLibrary.getState();
  useLibrary.setState({ presets: before.presets.filter((p) => p.id !== id) });
  // 撤销时整个放回原位；水印图片等撤销窗口过了、下次加图片时再清理
  return () => useLibrary.setState({ presets: before.presets });
}

export function importPresetText(text: string): number {
  const { presets, marks } = importPresets(text, newId);
  useLibrary.setState((l) => ({ presets: [...l.presets, ...presets] }));
  addMarks(marks);
  return presets.length;
}
