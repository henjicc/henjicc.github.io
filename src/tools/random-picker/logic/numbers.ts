// “生成号码”：按起止和步长生成一串号码当名单，常用于按学号点名。

export type NumberRange = { start: number; end: number; step: number; padZero: boolean };

/** 一次最多生成这么多个，防止手滑填了很大的结束值把页面卡住。 */
export const MAX_NUMBERS = 2000;

export type RangeErrors = Partial<Record<"start" | "end" | "step", string>>;

export function validateRange({ start, end, step }: NumberRange): RangeErrors {
  const errors: RangeErrors = {};
  if (!Number.isInteger(start)) errors.start = "起始填一个整数";
  if (!Number.isInteger(end)) errors.end = "结束填一个整数";
  else if (Number.isInteger(start) && end < start) errors.end = "结束不能比起始小";
  if (!Number.isInteger(step) || step < 1) errors.step = "间隔至少是 1";
  if (!errors.start && !errors.end && !errors.step && Math.floor((end - start) / step) + 1 > MAX_NUMBERS) {
    errors.end = `一次最多生成 ${MAX_NUMBERS} 个号码`;
  }
  return errors;
}

/** 补零时按结束值的位数补齐（1–50 → 01…50）；负数不补。 */
export function generateNumbers(range: NumberRange): string[] {
  const errors = validateRange(range);
  if (Object.keys(errors).length) return [];
  const { start, end, step, padZero } = range;
  const width = padZero ? String(Math.abs(end)).length : 0;
  const out: string[] = [];
  for (let n = start; n <= end; n += step) {
    out.push(padZero && n >= 0 ? String(n).padStart(width, "0") : String(n));
  }
  return out;
}
