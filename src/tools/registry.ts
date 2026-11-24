// 工具登记表：首页、工具箱、命令面板、路由预渲染和 TOY 打包都从这里读工具列表。
//
// 加一个工具 = 新建 src/tools/<id>/（meta.ts 默认导出元信息、Tool.tsx 默认导出界面）+ 在下面加一行。
// 每行必须保持 `defineTool(<meta>, () => import("./<id>/Tool"))` 的写法：TOY 打包时 vite.toy.config.ts
// 按同样的约定重新生成这个文件，只放进选中的工具，没选中的工具不会进包。
// 这里只用相对路径导入：react-router.config.ts 在 Node 里加载它，那里没有 ~ 别名。
import batchText from "./batch-text/meta";
import { defineTool } from "./define";
import randomPicker from "./random-picker/meta";

export const tools = [
  defineTool(randomPicker, () => import("./random-picker/Tool")),
  defineTool(batchText, () => import("./batch-text/Tool")),
];
