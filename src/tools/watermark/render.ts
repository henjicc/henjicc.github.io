// 按绘制方案往画布上画（浏览器侧）。预览和导出都走这里，只是缩放比例不同。
import { fontCss, planWatermark, type DrawPlan, type Measure } from "./logic/plan";
import type { Mark } from "./logic/presets";
import type { MarkSettings, SizeUnit } from "./logic/settings";

let measureContext: CanvasRenderingContext2D | null = null;

export const measureText: Measure = (text, font) => {
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * 10;
  measureContext.font = font;
  return measureContext.measureText(text).width;
};

export function planFor(settings: MarkSettings, size: { width: number; height: number }, unit: SizeUnit, mark: Mark | undefined): DrawPlan | null {
  return planWatermark(settings, size, unit, measureText, mark ?? null);
}

/**
 * 在 ctx 上画底图和水印。plan 的坐标是原图像素，scale 是画布相对原图的比例。
 * background 用于导出 JPEG：没有透明通道，不铺底的话透明处会变成黑色。
 */
export function drawWatermarked(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  plan: DrawPlan | null,
  scale: number,
  markImage: CanvasImageSource | null,
  background?: string,
) {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  if (plan && (plan.content.kind === "text" || markImage)) {
    ctx.scale(scale, scale);
    ctx.globalAlpha = plan.opacity;
    const content = plan.content;
    if (content.kind === "text") {
      ctx.font = fontCss(content.fontSize, content.family);
      ctx.fillStyle = content.color;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
    }
    for (const c of plan.centers) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(plan.rotation);
      if (content.kind === "text") {
        for (const line of content.lines) ctx.fillText(line.text, line.dx, line.dy);
      } else if (markImage) {
        ctx.drawImage(markImage, -content.width / 2, -content.height / 2, content.width, content.height);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}
