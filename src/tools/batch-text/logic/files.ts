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

export function previewText(content: string, max = 200): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export function baseName(name: string): string {
  return name.replace(TEXT_EXT, "");
}

/** a.md → a_processed.txt；.markdown 也去掉。 */
export function resultFileName(name: string, format: ExportFormat): string {
  return `${baseName(name)}_processed.${format}`;
}

/** 压缩包里不能有同名文件：重名的依次加上 (2)、(3)。 */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let n = 2;
    while (used.has(`${stem} (${n})${ext}`)) n++;
    const next = `${stem} (${n})${ext}`;
    used.add(next);
    return next;
  });
}

/** 2026-11-24_10-05-09，用在导出文件名里。 */
export function timestamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}
