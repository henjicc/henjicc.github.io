import { Stamp } from "lucide-react";
import type { ToolMeta } from "../types";

export default {
  id: "watermark",
  name: "水印工具",
  summary: "给图片加文字或图片水印，九宫格定位或整张平铺。",
  icon: Stamp,
  status: "live",
  keywords: ["syj", "sygj", "shuiyin", "watermark", "水印", "加水印", "图片"],
  toy: true,
} satisfies ToolMeta;
