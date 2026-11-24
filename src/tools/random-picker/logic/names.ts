// 名单与抽取的纯逻辑：不碰 React 和 DOM。

/** 每行一个名字；去掉首尾空白和空行。重名保留：两个同名的人就是两个人。 */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 从文件导入的名单：txt 每行一个名字；csv 取每行第一列（去掉引号）。
 * 表头不做猜测，用户导入后可以直接在文本框里删掉。
 */
export function namesFromFile(text: string, filename: string): string[] {
  const csv = /\.csv$/i.test(filename);
  const lines = parseNames(text.replace(/^\uFEFF/, ""));
  if (!csv) return lines;
  return lines
    .map((line) => {
      const first = line.split(",")[0] ?? "";
      return first.trim().replace(/^"(.*)"$/, "$1").trim();
    })
    .filter(Boolean);
}

/**
 * 还能抽到的人。不重复时，从名单里按次数去掉已经抽过的（重名的人各算一次）；
 * 名单改过之后，已经不在名单里的抽取记录不影响结果。
 */
export function remainingPool(names: readonly string[], picked: readonly string[], noRepeat: boolean): string[] {
  if (!noRepeat) return [...names];
  const taken = new Map<string, number>();
  for (const name of picked) taken.set(name, (taken.get(name) ?? 0) + 1);
  const pool: string[] = [];
  for (const name of names) {
    const left = taken.get(name) ?? 0;
    if (left > 0) taken.set(name, left - 1);
    else pool.push(name);
  }
  return pool;
}

export type Random = () => number;

export function pickOne<T>(pool: readonly T[], random: Random = Math.random): T | undefined {
  if (!pool.length) return undefined;
  const i = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[i];
}

/** 滚动时的下一帧：池子里不止一个名字时，避免和上一帧相同，看起来才是在滚。 */
export function nextRollingName(pool: readonly string[], previous: string | undefined, random: Random = Math.random): string | undefined {
  if (pool.length <= 1) return pool[0];
  const others = pool.filter((n) => n !== previous);
  return pickOne(others.length ? others : pool, random);
}

export type StartCheck = { ok: true } | { ok: false; reason: "empty" | "exhausted" };

export function canStart(names: readonly string[], pool: readonly string[]): StartCheck {
  if (!names.length) return { ok: false, reason: "empty" };
  if (!pool.length) return { ok: false, reason: "exhausted" };
  return { ok: true };
}
