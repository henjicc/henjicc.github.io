import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { formatFileSize, isAcceptedTextFile, resultFileName, uniqueNames } from "./files";
import { buildZip } from "./zip";

describe("文件", () => {
  it("按类型或扩展名接受文本文件", () => {
    expect(isAcceptedTextFile("a.txt", "")).toBe(true);
    expect(isAcceptedTextFile("A.MARKDOWN", "")).toBe(true);
    expect(isAcceptedTextFile("notes", "text/plain")).toBe(true);
    expect(isAcceptedTextFile("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
  });

  it("结果文件名去掉 .txt/.md/.markdown 再加后缀", () => {
    expect(resultFileName("稿子.markdown", "txt")).toBe("稿子_processed.txt");
    expect(resultFileName("a.md", "md")).toBe("a_processed.md");
    expect(resultFileName("a.b.txt", "md")).toBe("a.b_processed.md");
  });

  it("重名依次编号", () => {
    expect(uniqueNames(["a.txt", "a.txt", "b", "a.txt", "b"])).toEqual(["a.txt", "a (2).txt", "b", "a (3).txt", "b (2)"]);
  });

  it("大小", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });
});

describe("buildZip", () => {
  it("UTF-8 文本原样进包，重名不互相覆盖", () => {
    const zip = buildZip([
      { name: "一.txt", text: "雾里的林子" },
      { name: "一.txt", text: "第二份" },
    ]);
    const out = unzipSync(zip);
    expect(Object.keys(out)).toEqual(["一.txt", "一 (2).txt"]);
    expect(strFromU8(out["一.txt"]!)).toBe("雾里的林子");
  });
});
