import { describe, expect, it } from "vitest";
import { heifExif, insertExif, jpegExif, MAX_TIFF_BYTES, patchExif } from "./exif";

// 手工拼一段小端 TIFF：IFD0（方向 6、厂商 "Test"、Exif 指针）→ Exif IFD（像素宽高）→ IFD1（缩略图）→ 缩略图数据。
function buildTiff(bigEndian = false) {
  const buf = new ArrayBuffer(200);
  const v = new DataView(buf);
  const le = !bigEndian;
  const u8 = new Uint8Array(buf);
  u8.set(bigEndian ? [0x4d, 0x4d] : [0x49, 0x49]);
  v.setUint16(2, 42, le);
  v.setUint32(4, 8, le);
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    v.setUint16(at, tag, le);
    v.setUint16(at + 2, type, le);
    v.setUint32(at + 4, count, le);
    if (type === 3) v.setUint16(at + 8, value, le);
    else v.setUint32(at + 8, value, le);
  };
  // IFD0 @8：3 个条目，下一个 IFD 在 @100
  v.setUint16(8, 3, le);
  entry(10, 0x0112, 3, 1, 6);
  entry(22, 0x010f, 2, 4, 0);
  u8.set([84, 101, 115, 116], 30); // "Test" 直接放在条目里
  entry(34, 0x8769, 4, 1, 60);
  v.setUint32(46, 100, le);
  // Exif IFD @60
  v.setUint16(60, 2, le);
  entry(62, 0xa002, 4, 1, 4000);
  entry(74, 0xa003, 3, 1, 3000);
  v.setUint32(86, 0, le);
  // IFD1 @100：缩略图在 @150，长 50（一直到末尾）
  v.setUint16(100, 2, le);
  entry(102, 0x0201, 4, 1, 150);
  entry(114, 0x0202, 4, 1, 50);
  v.setUint32(126, 0, le);
  u8.fill(0xaa, 150, 200);
  return u8;
}

function read(t: Uint8Array, at: number, size: 2 | 4, le = true) {
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
  return size === 2 ? v.getUint16(at, le) : v.getUint32(at, le);
}

function jpegWith(...segments: number[][]) {
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
}
const app0 = [0xff, 0xe0, 0, 6, 0x4a, 0x46, 0x49, 0x46];
const app1 = (tiff: Uint8Array) => {
  const length = tiff.length + 8;
  return [0xff, 0xe1, length >> 8, length & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
};

describe("修补 EXIF", () => {
  it("方向改 1、像素宽高改成导出尺寸、厂商等其他字段原样保留", () => {
    const t = patchExif(buildTiff(), { width: 1200, height: 900 })!;
    expect(read(t, 18, 2)).toBe(1);
    expect(read(t, 70, 4)).toBe(1200);
    expect(read(t, 82, 2)).toBe(900);
    expect([...t.subarray(30, 34)]).toEqual([84, 101, 115, 116]);
  });

  it("大端字节序也认", () => {
    const t = patchExif(buildTiff(true), { width: 10, height: 20 })!;
    expect(read(t, 18, 2, false)).toBe(1);
    expect(read(t, 70, 4, false)).toBe(10);
  });

  it("去掉缩略图：断开 IFD1，末尾的缩略图截掉", () => {
    const t = patchExif(buildTiff(), { width: 1, height: 1 })!;
    expect(read(t, 46, 4)).toBe(0);
    expect(t.length).toBe(150);
    expect(t.includes(0xaa)).toBe(false);
  });

  it("宽高超过 SHORT 能放的范围时不写坏数据", () => {
    const t = patchExif(buildTiff(), { width: 70000, height: 70000 })!;
    expect(read(t, 70, 4)).toBe(70000);
    expect(read(t, 82, 2)).toBe(3000);
  });

  it("不改原数据，不是 TIFF 返回 null", () => {
    const src = buildTiff();
    patchExif(src, { width: 1, height: 1 });
    expect(read(src, 18, 2)).toBe(6);
    expect(patchExif(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), { width: 1, height: 1 })).toBeNull();
  });
});

describe("JPEG 里的 EXIF", () => {
  it("取出 APP1 里的 TIFF", () => {
    const tiff = buildTiff();
    expect(jpegExif(jpegWith(app0, app1(tiff)))).toEqual(tiff);
    expect(jpegExif(jpegWith(app0))).toBeNull();
    expect(jpegExif(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  it("插到 JFIF 后面，替换掉原有的 EXIF，图像数据不动", () => {
    const old = new Uint8Array([0x49, 0x49, 42, 0, 8, 0, 0, 0, 0, 0]);
    const tiff = buildTiff();
    const out = insertExif(jpegWith(app0, app1(old)), tiff);
    expect([...out.subarray(0, 2 + app0.length)]).toEqual([0xff, 0xd8, ...app0]);
    expect(jpegExif(out)).toEqual(tiff);
    expect(out.filter((b, i) => b === 0xff && out[i + 1] === 0xe1)).toHaveLength(1);
    expect([...out.subarray(out.length - 9)]).toEqual([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
  });

  it("太大放不进一个段时不带", () => {
    const jpeg = jpegWith(app0);
    expect(insertExif(jpeg, new Uint8Array(MAX_TIFF_BYTES + 1))).toBe(jpeg);
  });
});

describe("HEIC 里的 EXIF", () => {
  const box = (type: string, body: number[]) => {
    const size = 8 + body.length;
    return [size >>> 24, (size >> 16) & 255, (size >> 8) & 255, size & 255, ...[...type].map((c) => c.charCodeAt(0)), ...body];
  };
  const u16 = (n: number) => [n >> 8, n & 255];
  const u32 = (n: number) => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255];

  // ftyp + meta(iinf: 图像条目 1、Exif 条目 2；iloc v0: 4 字节偏移和长度) + mdat(Exif 数据)
  function buildHeif(tiff: Uint8Array) {
    const infe = (id: number, type: string) => box("infe", [2, 0, 0, 0, ...u16(id), ...u16(0), ...[...type].map((c) => c.charCodeAt(0)), 0]);
    const iinf = box("iinf", [0, 0, 0, 0, ...u16(2), ...infe(1, "hvc1"), ...infe(2, "Exif")]);
    const exifData = [...u32(0), ...tiff];
    const ftyp = box("ftyp", [..."heic".split("").map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);
    const ilocFor = (offset: number) =>
      box("iloc", [0, 0, 0, 0, 0x44, 0x00, ...u16(2), ...u16(1), ...u16(0), ...u16(1), ...u32(0), ...u32(4), ...u16(2), ...u16(0), ...u16(1), ...u32(offset), ...u32(exifData.length)]);
    const metaFor = (offset: number) => box("meta", [0, 0, 0, 0, ...box("hdlr", [0, 0, 0, 0, 0, 0, 0, 0, 0x70, 0x69, 0x63, 0x74]), ...iinf, ...ilocFor(offset)]);
    const head = ftyp.length + metaFor(0).length + 8;
    return new Uint8Array([...ftyp, ...metaFor(head), ...box("mdat", exifData)]);
  }

  it("按 iinf / iloc 找到 Exif 条目的数据", () => {
    const tiff = buildTiff();
    expect(heifExif(buildHeif(tiff))).toEqual(tiff);
  });

  it("没有 Exif 条目或数据坏了返回 null", () => {
    expect(heifExif(new Uint8Array([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]))).toBeNull();
    const broken = buildHeif(buildTiff()).slice(0, 120);
    expect(heifExif(broken)).toBeNull();
  });
});
