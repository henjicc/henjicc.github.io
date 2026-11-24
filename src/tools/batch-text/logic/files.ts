export type ExportFormat = "txt" | "md";

const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);
const TEXT_EXT = /\.(txt|md|markdown)$/i;

export function isAcceptedTextFile(name: string, type: string): boolean {
  return TEXT_TYPES.has(type) || TEXT_EXT.test(name);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 单个文件的上限：2 MB 文本大约是几十万到上百万个 token，超过绝大多数模型一次能读的长度，发出去也只会被接口拒掉；
 * 这么大的文件整份放在内存和列表里也会让页面变卡。
 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function previewText(content: string, max = 200): string {
  // 先截一段再合并空白：每次渲染都对整份大文件跑正则会卡。留 4 倍余量给被合并掉的空白
  const cut = content.length > max * 4;
  const flat = content.slice(0, max * 4).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : cut ? `${flat}…` : flat;
}

export function baseName(name: string): string {
  return name.replace(TEXT_EXT, "");
}

/** a.md → a_processed.txt；.markdown 也去掉。 */
export function resultFileName(name: string, format: ExportFormat): string {
  return `${baseName(name)}_processed.${format}`;
}

/** 压缩包里不能有同名文件：重名的依次加上 (2)、(3)。Windows 和 macOS 默认不分大小写，A.txt 和 a.txt 解压时会互相覆盖，也算重名。 */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  const taken = (name: string) => used.has(name.toLowerCase());
  return names.map((name) => {
    let next = name;
    if (taken(name)) {
      const dot = name.lastIndexOf(".");
      const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
      let n = 2;
      while (taken(`${stem} (${n})${ext}`)) n++;
      next = `${stem} (${n})${ext}`;
    }
    used.add(next.toLowerCase());
    return next;
  });
}

/** 2026-11-24_10-05-09，用在导出文件名里。 */
export function timestamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}
