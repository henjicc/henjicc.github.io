export const isToy = __PLATFORM__ === "toy";

/** TOY 打包目标："toolbox" 是工具箱合集，其余是单个工具的 id；网站为 null。 */
export const toyTarget = __TOY_TARGET__;

/** 单工具 TOY：整个包只有这一个工具，页面就是它，没有列表可回。 */
export const singleToolId = isToy && toyTarget !== "toolbox" ? toyTarget : null;

/** 工具页“返回”去哪：网站回工具箱，TOY 合集回首页的工具列表；单工具 TOY 没有可回的地方。 */
export const toolsHome: string | null = !isToy ? "/tools/" : singleToolId ? null : "/";
