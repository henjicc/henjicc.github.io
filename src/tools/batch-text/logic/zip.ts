import { strToU8, zipSync } from "fflate";
import { uniqueNames } from "./files";

/** 文本文件打成 ZIP（UTF-8）。结果文件都是文本，压缩比高，用同步版本足够快。 */
export function buildZip(files: readonly { name: string; text: string }[]): Uint8Array<ArrayBuffer> {
  const names = uniqueNames(files.map((f) => f.name));
  const entries: Record<string, Uint8Array> = {};
  files.forEach((f, i) => {
    entries[names[i] as string] = strToU8(f.text);
  });
  return zipSync(entries, { level: 6 }) as Uint8Array<ArrayBuffer>;
}
