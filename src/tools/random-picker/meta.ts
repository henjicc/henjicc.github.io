import { Shuffle } from "lucide-react";
import type { ToolMeta } from "../types";

export default {
  id: "random-picker",
  name: "随机抽取",
  summary: "导入名单，全屏滚动抽人，点名和抽奖都能用。",
  icon: Shuffle,
  status: "live",
  keywords: ["sjcq", "suiji", "dianming", "点名", "抽奖", "抽签", "picker"],
  toy: true,
} satisfies ToolMeta;
