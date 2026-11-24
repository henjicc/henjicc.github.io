import { unzipSync } from "fflate";
import { expect, it } from "vitest";
import { createZipStream } from "./zip";

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
