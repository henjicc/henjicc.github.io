// 边生成边打包的 ZIP：每张图编码好就流式写进压缩包，写完即可释放，内存里不用同时攥着全部图片和整个压缩包。
import { Zip, ZipPassThrough } from "fflate";
import { uniqueNamer } from "./logic/output";

export type ZipStream = {
  /** 按顺序加一个文件；同名时自动加 (2)、(3)。等这个文件全部写进去再返回。 */
  add(name: string, file: Blob): Promise<void>;
  /** 写完目录，返回整个压缩包。 */
  finish(): Promise<Blob>;
};

export function createZipStream(): ZipStream {
  // 写出来的每一段都立即包成 Blob：浏览器可以把大的 Blob 放到磁盘上，不必一直留在 JS 堆里
  const parts: Blob[] = [];
  let failure: Error | null = null;
  let resolveEnd: (blob: Blob) => void;
  let rejectEnd: (error: Error) => void;
  const ended = new Promise<Blob>((resolve, reject) => {
    resolveEnd = resolve;
    rejectEnd = reject;
  });
  // 出错后 add 会抛出，调用方通常就不再调 finish；没人等 ended 时它的拒绝会变成未处理的 Promise 拒绝。
  // 这里只标记为已处理，调 finish 的调用方照样拿到同一个拒绝。
  ended.catch(() => {});
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      failure = error;
      rejectEnd(error);
      return;
    }
    parts.push(new Blob([chunk as Uint8Array<ArrayBuffer>]));
    if (final) resolveEnd(new Blob(parts, { type: "application/zip" }));
  });
  const unique = uniqueNamer();

  return {
    async add(name, file) {
      if (failure) throw failure;
      // 图片本身已经压缩过，再压一遍几乎不变小，只存储不压缩
      const entry = new ZipPassThrough(unique(name));
      zip.add(entry);
      const reader = file.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        entry.push(value);
      }
      entry.push(new Uint8Array(0), true);
      if (failure) throw failure;
    },
    finish() {
      zip.end();
      return ended;
    },
  };
}
