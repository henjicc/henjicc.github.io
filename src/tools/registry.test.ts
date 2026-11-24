import { describe, expect, it } from "vitest";
import { site } from "~/content/site";
import { siteSchema } from "~/content/schema";
import { tools } from "./registry";
import { validateRegistry } from "./schema";
import { defineTool } from "./define";
import randomPicker from "./random-picker/meta";

describe("登记表", () => {
  it("每个工具的元信息都合规，可用的工具都有界面", () => {
    expect(() => validateRegistry(tools)).not.toThrow();
  });

  it("拦下重复的 id 和没有界面的可用工具", () => {
    const entry = defineTool(randomPicker, async () => ({ default: () => null }));
    expect(() => validateRegistry([entry, entry])).toThrow(/重复/);
    expect(() => validateRegistry([defineTool(randomPicker)])).toThrow(/界面/);
    expect(() => validateRegistry([defineTool({ ...randomPicker, id: "Random Picker" })])).toThrow();
  });
});

describe("站点内容", () => {
  it("符合结构", () => {
    expect(() => siteSchema.parse(site)).not.toThrow();
  });
});
