import type { CSSProperties } from "react";
// 雾林场景照片（设计系统里的 mistwood-scene.jpg，就是旧首页的背景图）。只用在首页首屏、404 和空状态这类品牌时刻。
import sceneUrl from "../../imgs/BG01.jpg";

export const sceneStyle = { "--scene-img": `url(${sceneUrl})` } as CSSProperties;
