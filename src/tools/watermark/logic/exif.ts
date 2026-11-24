// 导出 JPEG 时带上原图的拍摄信息（EXIF）。
//
// 只搬原图里那一整块 TIFF 格式的 EXIF 数据，原地改几个值，不逐项解析和重新编码：
// 这样不用维护标签对照表，厂商私有字段也原样保留。需要改的只有：
// - 方向（Orientation）改成 1：像素在解码时已经按原方向摆正了，留着原值部分看图软件会再转一次；
// - 像素宽高改成导出的尺寸；
// - 缩略图清掉：它是没有水印的原图缩小版。
// 选不用库的原因：能读写 JPEG EXIF 的 piexifjs 已多年不更新且只认 JPEG，HEIC 还得另配一个读取库再转换结构；
// 维护中的 exifreader / exifr 只能读、拿不到原始数据块。

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
/** APP1 段长度字段是 16 位，含自身 2 字节和 6 字节头，TIFF 数据最多这么长；更长的放不进去就不带。 */
export const MAX_TIFF_BYTES = 0xffff - 2 - EXIF_HEADER.length;

const TAG_ORIENTATION = 0x0112;
const TAG_EXIF_IFD = 0x8769;
const TAG_PIXEL_X = 0xa002;
const TAG_PIXEL_Y = 0xa003;
const TAG_THUMB_OFFSET = 0x0201;
const TAG_THUMB_LENGTH = 0x0202;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;

function startsWith(bytes: Uint8Array, at: number, sig: readonly number[]): boolean {
  if (at + sig.length > bytes.length) return false;
  return sig.every((b, i) => bytes[at + i] === b);
}

/** 从 JPEG 里取出 EXIF 的 TIFF 数据（APP1 "Exif\0\0" 之后的部分）；没有就返回 null。 */
export function jpegExif(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) return null;
    const marker = bytes[p + 1]!;
    // 填充字节
    if (marker === 0xff) {
      p++;
      continue;
    }
    // 图像数据开始或文件结束，后面不会再有元数据段
    if (marker === 0xda || marker === 0xd9) return null;
    const length = (bytes[p + 2]! << 8) | bytes[p + 3]!;
    if (length < 2) return null;
    if (marker === 0xe1 && startsWith(bytes, p + 4, EXIF_HEADER)) {
      const end = Math.min(bytes.length, p + 2 + length);
      return bytes.slice(p + 4 + EXIF_HEADER.length, end);
    }
    p += 2 + length;
  }
  return null;
}

type Box = { type: string; start: number; body: number; end: number };

function readBoxes(view: DataView, from: number, to: number): Box[] {
  const boxes: Box[] = [];
  let p = from;
  while (p + 8 <= to) {
    let size = view.getUint32(p);
    const type = String.fromCharCode(view.getUint8(p + 4), view.getUint8(p + 5), view.getUint8(p + 6), view.getUint8(p + 7));
    let body = p + 8;
    if (size === 1) {
      if (p + 16 > to) break;
      size = Number(view.getBigUint64(p + 8));
      body = p + 16;
    } else if (size === 0) {
      size = to - p;
    }
    if (size < body - p || p + size > to) break;
    boxes.push({ type, start: p, body, end: p + size });
    p += size;
  }
  return boxes;
}

function readUint(view: DataView, at: number, size: number): number {
  if (size === 0) return 0;
  if (size === 2) return view.getUint16(at);
  if (size === 4) return view.getUint32(at);
  if (size === 8) return Number(view.getBigUint64(at));
  throw new Error(`bad int size ${size}`);
}

/**
 * 从 HEIC / HEIF 里取出 EXIF 的 TIFF 数据：meta 盒子的 iinf 里找类型为 "Exif" 的条目，再按 iloc 找到它的数据。
 * 条目数据开头是 4 字节的“TIFF 头偏移”。结构不认识或数据不完整时返回 null。
 */
export function heifExif(bytes: Uint8Array): Uint8Array | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const meta = readBoxes(view, 0, bytes.length).find((b) => b.type === "meta");
    if (!meta) return null;
    // meta 是 FullBox：4 字节版本和标志
    const children = readBoxes(view, meta.body + 4, meta.end);
    const iinf = children.find((b) => b.type === "iinf");
    const iloc = children.find((b) => b.type === "iloc");
    if (!iinf || !iloc) return null;

    const iinfVersion = view.getUint8(iinf.body);
    const entriesAt = iinf.body + 4 + (iinfVersion === 0 ? 2 : 4);
    let exifId: number | null = null;
    for (const infe of readBoxes(view, entriesAt, iinf.end)) {
      if (infe.type !== "infe") continue;
      const version = view.getUint8(infe.body);
      if (version < 2) continue;
      const idSize = version === 2 ? 2 : 4;
      const id = readUint(view, infe.body + 4, idSize);
      const typeAt = infe.body + 4 + idSize + 2;
      if (startsWith(bytes, typeAt, [0x45, 0x78, 0x69, 0x66])) {
        exifId = id;
        break;
      }
    }
    if (exifId === null) return null;

    const version = view.getUint8(iloc.body);
    let p = iloc.body + 4;
    const sizes1 = view.getUint8(p);
    const sizes2 = view.getUint8(p + 1);
    p += 2;
    const offsetSize = sizes1 >> 4;
    const lengthSize = sizes1 & 0xf;
    const baseOffsetSize = sizes2 >> 4;
    const indexSize = version === 1 || version === 2 ? sizes2 & 0xf : 0;
    const count = version < 2 ? view.getUint16(p) : view.getUint32(p);
    p += version < 2 ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const id = version < 2 ? view.getUint16(p) : view.getUint32(p);
      p += version < 2 ? 2 : 4;
      let construction = 0;
      if (version === 1 || version === 2) {
        construction = view.getUint16(p) & 0xf;
        p += 2;
      }
      p += 2; // data_reference_index
      const base = readUint(view, p, baseOffsetSize);
      p += baseOffsetSize;
      const extents = view.getUint16(p);
      p += 2;
      const parts: Uint8Array[] = [];
      for (let e = 0; e < extents; e++) {
        p += indexSize;
        const offset = readUint(view, p, offsetSize);
        p += offsetSize;
        const length = readUint(view, p, lengthSize);
        p += lengthSize;
        parts.push(bytes.subarray(base + offset, base + offset + length));
      }
      if (id !== exifId) continue;
      // 只认数据直接在文件里的情况（construction_method 0）
      if (construction !== 0 || !parts.length) return null;
      const data = concat(parts);
      if (data.length < 4) return null;
      const tiffAt = 4 + new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0);
      const tiff = data.slice(tiffAt);
      return isTiff(tiff) ? tiff : null;
    }
    return null;
  } catch {
    return null;
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function isTiff(t: Uint8Array): boolean {
  return t.length >= 8 && ((t[0] === 0x49 && t[1] === 0x49 && t[2] === 42 && t[3] === 0) || (t[0] === 0x4d && t[1] === 0x4d && t[2] === 0 && t[3] === 42));
}

type Entry = { at: number; tag: number; type: number; count: number };

class Tiff {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  readonly le: boolean;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.le = bytes[0] === 0x49;
  }
  u16(at: number) {
    return this.view.getUint16(at, this.le);
  }
  u32(at: number) {
    return this.view.getUint32(at, this.le);
  }
  set16(at: number, v: number) {
    this.view.setUint16(at, v, this.le);
  }
  set32(at: number, v: number) {
    this.view.setUint32(at, v, this.le);
  }
  /** 一个 IFD 的条目和“下一个 IFD 偏移”所在的位置；越界返回 null。 */
  ifd(offset: number): { entries: Entry[]; nextAt: number } | null {
    if (offset < 8 || offset + 2 > this.bytes.length) return null;
    const n = this.u16(offset);
    const nextAt = offset + 2 + n * 12;
    if (nextAt + 4 > this.bytes.length) return null;
    const entries: Entry[] = [];
    for (let i = 0; i < n; i++) {
      const at = offset + 2 + i * 12;
      entries.push({ at, tag: this.u16(at), type: this.u16(at + 2), count: this.u32(at + 4) });
    }
    return { entries, nextAt };
  }
  /** 只处理值直接放在条目里的 SHORT / LONG（count 为 1）。 */
  setInline(e: Entry, value: number): boolean {
    if (e.count !== 1) return false;
    if (e.type === TYPE_SHORT && value <= 0xffff) {
      this.set16(e.at + 8, value);
      return true;
    }
    if (e.type === TYPE_LONG) {
      this.set32(e.at + 8, value);
      return true;
    }
    return false;
  }
  inline(e: Entry): number | null {
    if (e.count !== 1) return null;
    if (e.type === TYPE_SHORT) return this.u16(e.at + 8);
    if (e.type === TYPE_LONG) return this.u32(e.at + 8);
    return null;
  }
}

/**
 * 把原图的 EXIF 改成适合导出图的版本（返回新数组，不改原数据）：方向设为 1、像素宽高设为导出尺寸、去掉缩略图。
 * 数据不是合法的 TIFF 时返回 null（导出时就不带 EXIF）。
 */
export function patchExif(source: Uint8Array, size: { width: number; height: number }): Uint8Array | null {
  if (!isTiff(source)) return null;
  let bytes = source.slice();
  const t = new Tiff(bytes);
  const ifd0 = t.ifd(t.u32(4));
  if (!ifd0) return null;
  for (const e of ifd0.entries) {
    if (e.tag === TAG_ORIENTATION) t.setInline(e, 1);
    if (e.tag === TAG_EXIF_IFD) {
      const exif = t.ifd(t.u32(e.at + 8));
      for (const x of exif?.entries ?? []) {
        if (x.tag === TAG_PIXEL_X) t.setInline(x, size.width);
        if (x.tag === TAG_PIXEL_Y) t.setInline(x, size.height);
      }
    }
  }
  // IFD1 是缩略图：断开链接，并把缩略图数据清零；缩略图在末尾时直接截掉
  const ifd1Offset = t.u32(ifd0.nextAt);
  if (ifd1Offset) {
    t.set32(ifd0.nextAt, 0);
    const ifd1 = t.ifd(ifd1Offset);
    if (ifd1) {
      let thumbStart = -1;
      let thumbLength = 0;
      for (const e of ifd1.entries) {
        if (e.tag === TAG_THUMB_OFFSET) thumbStart = t.inline(e) ?? -1;
        if (e.tag === TAG_THUMB_LENGTH) thumbLength = t.inline(e) ?? 0;
      }
      bytes.fill(0, ifd1Offset, ifd1.nextAt + 4);
      if (thumbStart >= 8 && thumbLength > 0 && thumbStart + thumbLength <= bytes.length) {
        bytes.fill(0, thumbStart, thumbStart + thumbLength);
        // 缩略图通常在最后，截掉能省下几十 KB；在中间时只清零，后面可能还有别的数据
        if (thumbStart + thumbLength === bytes.length) bytes = bytes.slice(0, thumbStart);
      }
    }
  }
  return bytes;
}

/**
 * 把 TIFF 数据作为 APP1 段插进 JPEG：放在 SOI 和 JFIF（APP0）之后，并去掉 JPEG 里原有的 EXIF 段。
 * 数据太大放不进一个段时原样返回 JPEG。
 */
export function insertExif(jpeg: Uint8Array, tiff: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || tiff.length > MAX_TIFF_BYTES) return jpeg;
  const segments: Uint8Array[] = [];
  let insertAt = 2;
  let p = 2;
  const kept: Uint8Array[] = [jpeg.subarray(0, 2)];
  while (p + 4 <= jpeg.length && jpeg[p] === 0xff) {
    const marker = jpeg[p + 1]!;
    if (marker === 0xda || marker < 0xe0 || marker > 0xef) break;
    const length = (jpeg[p + 2]! << 8) | jpeg[p + 3]!;
    const segment = jpeg.subarray(p, p + 2 + length);
    const isExif = marker === 0xe1 && startsWith(jpeg, p + 4, EXIF_HEADER);
    if (!isExif) {
      if (marker === 0xe0 && insertAt === p) {
        kept.push(segment);
        insertAt = p + 2 + length;
      } else {
        segments.push(segment);
      }
    }
    p += 2 + length;
  }
  const length = 2 + EXIF_HEADER.length + tiff.length;
  const app1 = new Uint8Array(2 + length);
  app1.set([0xff, 0xe1, length >> 8, length & 0xff, ...EXIF_HEADER]);
  app1.set(tiff, 4 + EXIF_HEADER.length);
  return concat([...kept, app1, ...segments, jpeg.subarray(p)]);
}
