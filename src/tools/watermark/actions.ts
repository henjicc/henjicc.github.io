// 改状态的操作：界面只调这些，不直接拼 store 的结构。
import { createPreset, importPresets, LIBRARY_BUDGET, LibraryFullError, librarySize, pruneMarks, type Mark, type Preset } from "./logic/presets";
import { clickSelect, targetIds } from "./logic/selection";
import { clampSize, FACTORY_APP, filenameAsText, type AppSettings, type MarkSettings, type SizeUnit } from "./logic/settings";
import { compactMark, readImage, readMarkImage } from "./image";
import { libraryWritten, useApp, useDraft, useLibrary, useSession, type ImageItem } from "./store";

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

/** 恢复成默认设置（“设为默认”存下的那套）：有多选时作用于选中的图，否则当前图。返回改了几张。 */
export function resetToDefaults(): number {
  const defaults = useApp.getState().defaults;
  const ids = targets().map((im) => im.id);
  const s = useSession.getState();
  useSession.setState({ images: s.images.map((im) => (ids.includes(im.id) ? { ...im, settings: defaults } : im)) });
  if (!s.currentId || ids.includes(s.currentId)) useDraft.setState({ current: defaults });
  return ids.length;
}

export function saveAsDefaults() {
  useApp.setState({ defaults: useDraft.getState().current });
}

/** 默认设置和偏好都还是出厂值时，“恢复出厂设置”没有意义。 */
export function isFactoryApp(app: AppSettings): boolean {
  return JSON.stringify(app) === JSON.stringify(FACTORY_APP);
}

/** 恢复出厂设置：默认水印和偏好回到出厂值，并把出厂水印用到 resetToDefaults 作用的那几张图上。返回撤销函数。 */
export function factoryReset(): () => void {
  const app = useApp.getState();
  const draft = useDraft.getState().current;
  const images = useSession.getState().images;
  useApp.setState({ ...FACTORY_APP });
  resetToDefaults();
  return () => {
    useApp.setState(app);
    useDraft.setState({ current: draft });
    const byId = new Map(images.map((im) => [im.id, im.settings]));
    useSession.setState((s) => ({ images: s.images.map((im) => ({ ...im, settings: byId.get(im.id) ?? im.settings })) }));
  };
}

function marksInUse(presets: readonly Preset[] = useLibrary.getState().presets): (string | null)[] {
  return [
    useDraft.getState().current.markId,
    useApp.getState().defaults.markId,
    ...useSession.getState().images.map((im) => im.settings.markId),
    ...presets.map((p) => p.settings.markId),
  ];
}

type LibraryData = { marks: Record<string, Mark>; presets: Preset[] };

/**
 * 在 current 上撤掉 before → next 这一步增删的预设和水印图片，别的保持 current 的样子。
 * 不能直接退回 before：等写入结果的时候用户可能又删了预设、加了图片，整体退回会把这些改动一起抹掉。
 */
function revertChange(current: LibraryData, before: LibraryData, next: LibraryData): LibraryData {
  const beforeIds = new Set(before.presets.map((p) => p.id));
  const nextIds = new Set(next.presets.map((p) => p.id));
  const presets = current.presets.filter((p) => beforeIds.has(p.id) || !nextIds.has(p.id));
  before.presets.forEach((p, i) => {
    if (!nextIds.has(p.id) && !presets.some((q) => q.id === p.id)) presets.splice(Math.min(i, presets.length), 0, p);
  });
  const marks = { ...current.marks };
  for (const [id, mark] of Object.entries(next.marks)) {
    if (!(id in before.marks) && marks[id] === mark) delete marks[id];
  }
  for (const [id, mark] of Object.entries(before.marks)) {
    if (!(id in next.marks) && !(id in marks)) marks[id] = mark;
  }
  return { marks, presets };
}

/**
 * 改预设库都走这里：先按整库预算检查，写进去之后确认存储里真的有了。
 * 超预算或写不进去时抛 LibraryFullError，内存里也撤掉这次的改动，界面不会显示一个重载后就没了的预设。
 */
async function commitLibrary(change: (library: LibraryData) => LibraryData) {
  const before = useLibrary.getState();
  const next = change({ marks: before.marks, presets: before.presets });
  if (librarySize(next) > LIBRARY_BUDGET && librarySize(next) > librarySize(before)) {
    throw new LibraryFullError(`预设和水印图片加起来不能超过 ${LIBRARY_BUDGET / 1_000_000}MB，删掉几个带图片的预设再试`);
  }
  useLibrary.setState(next);
  if (await libraryWritten()) return;
  useLibrary.setState(revertChange(useLibrary.getState(), before, next));
  throw new LibraryFullError("浏览器的本机存储满了，没存上。删掉几个带图片的预设再试");
}

function withMarks(marks: Readonly<Record<string, Mark>>, added: readonly Mark[], presets: readonly Preset[]): Record<string, Mark> {
  const all = { ...marks };
  for (const m of added) all[m.id] = m;
  return pruneMarks(all, [...marksInUse(presets), ...added.map((m) => m.id)]);
}

export async function chooseMarkImage(file: File) {
  const mark = await readMarkImage(file, newId());
  await commitLibrary((l) => ({ presets: l.presets, marks: withMarks(l.marks, [mark], l.presets) }));
  patchSettings({ type: "image", markId: mark.id });
}

export async function savePreset(name: string) {
  const preset = createPreset(name, useDraft.getState().current, newId(), new Date());
  await commitLibrary((l) => ({ marks: l.marks, presets: [...l.presets, preset] }));
}

export function loadPreset(id: string) {
  const preset = useLibrary.getState().presets.find((p) => p.id === id);
  if (preset) updateSettings({ ...preset.settings, size: clampSize(preset.settings.size, useApp.getState().unit) });
}

/**
 * 删除预设，返回撤销函数。撤销窗口里如果加了别的水印图片，没人用的图片（包括这个预设的）会被清理掉，
 * 所以撤销时把这个预设的图片一起放回去。
 */
export function deletePreset(id: string): () => Promise<void> {
  const before = useLibrary.getState();
  const index = before.presets.findIndex((p) => p.id === id);
  const preset = before.presets[index];
  const mark = preset?.settings.markId ? before.marks[preset.settings.markId] : undefined;
  useLibrary.setState({ presets: before.presets.filter((p) => p.id !== id) });
  return async () => {
    if (!preset) return;
    await commitLibrary((l) => {
      if (l.presets.some((p) => p.id === id)) return l;
      const presets = [...l.presets];
      presets.splice(Math.min(index, presets.length), 0, preset);
      return { presets, marks: mark ? { ...l.marks, [mark.id]: mark } : l.marks };
    });
  };
}

export async function importPresetText(text: string): Promise<number> {
  const parsed = importPresets(text, newId);
  const marks = await Promise.all(parsed.marks.map(compactMark));
  await commitLibrary((l) => {
    const presets = [...l.presets, ...parsed.presets];
    return { presets, marks: withMarks(l.marks, marks, presets) };
  });
  return parsed.presets.length;
}
