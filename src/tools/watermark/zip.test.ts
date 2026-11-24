import { unzipSync } from "fflate";
import { expect, it, vi } from "vitest";
import { createZipStream } from "./zip";

it("打包出错后不调 finish：add 抛出，不留下未处理的 Promise 拒绝", async () => {
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  try {
    const zip = createZipStream();
    // ZIP 的文件名最长 65535 字节，超出时 fflate 通过回调报错
    await expect(zip.add(`${"长".repeat(30_000)}.png`, new Blob([new Uint8Array([1])]))).rejects.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    process.off("unhandledRejection", unhandled);
  }
});

it("出错后再调 finish 仍拿到拒绝", async () => {
  const zip = createZipStream();
  await zip.add(`${"长".repeat(30_000)}.png`, new Blob([])).catch(() => {});
  await expect(zip.finish()).rejects.toThrow();
});

it("逐个加进去的文件都在压缩包里，内容不变，重名的加上序号", async () => {
  const zip = createZipStream();
  const big = new Uint8Array(300_000).map((_, i) => i % 251);
  await zip.add("a.png", new Blob([big]));
  await zip.add("A.png", new Blob([new Uint8Array([1, 2, 3])]));
  await zip.add("b.jpg", new Blob([]));
  const blob = await zip.finish();
  expect(blob.type).toBe("application/zip");
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  expect(Object.keys(files)).toEqual(["a.png", "A (2).png", "b.jpg"]);
  expect(files["a.png"]).toEqual(big);
  expect([...files["A (2).png"]!]).toEqual([1, 2, 3]);
  expect(files["b.jpg"]).toHaveLength(0);
});
