// 多图的选择规则：单击切换当前图并清空多选，Ctrl/⌘ 单击加减一张，Shift 单击从上次点的那张选到这张。

export type Selection = { selected: string[]; anchor: string | null };

export function clickSelect(ids: readonly string[], state: Selection, id: string, mods: { toggle?: boolean; range?: boolean }): Selection {
  if (mods.range && state.anchor && ids.includes(state.anchor)) {
    const a = ids.indexOf(state.anchor);
    const b = ids.indexOf(id);
    const [from, to] = a < b ? [a, b] : [b, a];
    return { selected: ids.slice(from, to + 1), anchor: state.anchor };
  }
  if (mods.toggle) {
    const selected = state.selected.includes(id) ? state.selected.filter((s) => s !== id) : [...state.selected, id];
    return { selected: ids.filter((i) => selected.includes(i)), anchor: id };
  }
  return { selected: [], anchor: id };
}

/** 有多选时操作选中的图（按列表顺序），否则只操作当前图。 */
export function targetIds(ids: readonly string[], selected: readonly string[], current: string | null): string[] {
  if (selected.length) return ids.filter((i) => selected.includes(i));
  return current && ids.includes(current) ? [current] : [];
}
