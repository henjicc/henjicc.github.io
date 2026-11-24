import { describe, expect, it } from "vitest";
import { videosFileSchema } from "./schema";
import snapshot from "./videos.json";
import { formatCount, formatDate, formatDuration } from "./videos";

describe("videos.json", () => {
  it("提交的快照符合结构", () => {
    expect(() => videosFileSchema.parse(snapshot)).not.toThrow();
  });

  it("结构不允许多余的资料字段混进来", () => {
    // 接口的简介里有联系方式；结构是 strip 模式，脚本写文件前会丢掉没登记的字段
    const parsed = videosFileSchema.parse({ ...snapshot, profile: { ...snapshot.profile, sign: "x" } });
    expect(parsed.profile).not.toHaveProperty("sign");
  });

  it("bvid 重复时校验不过", () => {
    const first = snapshot.videos[0]!;
    expect(() => videosFileSchema.parse({ ...snapshot, videos: [first, first] })).toThrow();
  });
});

describe("显示格式", () => {
  it("播放量按万、亿取一位小数", () => {
    expect(formatCount(9999)).toBe("9999");
    expect(formatCount(688813)).toBe("68.9万");
    expect(formatCount(210000)).toBe("21万");
    expect(formatCount(77222397)).toBe("7722.2万");
    expect(formatCount(123456789)).toBe("1.2亿");
  });

  it("时长不到一小时写分秒，超过写时分秒", () => {
    expect(formatDuration(356)).toBe("05:56");
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("日期按北京时间，跨年时带年份", () => {
    // UTC 16:30 已经是北京时间第二天
    expect(formatDate("2026-10-31T16:30:00.000Z", "2026-11-24T00:00:00.000Z")).toBe("11月1日");
    expect(formatDate("2025-12-01T00:00:00.000Z", "2026-11-24T00:00:00.000Z")).toBe("2025年12月1日");
  });
});
