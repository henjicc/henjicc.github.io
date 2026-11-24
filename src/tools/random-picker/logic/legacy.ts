// 旧版随机点名（2024 版，旧站点的 tools/random-picker/script.js）在 localStorage 的 namePickerData 里存
// { names: string[], settings: { backgroundColor, textColor, fontSizeRatio } }。新版只接名单，颜色设置已经没有对应项。
import { z } from "zod";
import { parseNames } from "./names";

export const LEGACY_KEY = "namePickerData";

const legacySchema = z.object({ names: z.array(z.unknown()) });

/** 旧数据里的名单，按新版的格式（每行一个）返回；没有名单或数据不对时返回 undefined。 */
export function legacyNamesText(data: unknown): string | undefined {
  const parsed = legacySchema.safeParse(data);
  if (!parsed.success) return undefined;
  const names = parseNames(parsed.data.names.filter((n): n is string => typeof n === "string").join("\n"));
  return names.length ? names.join("\n") : undefined;
}
