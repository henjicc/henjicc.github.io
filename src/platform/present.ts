// 存不了图时把图片显示出来让用户长按保存。界面由外壳注册（src/shell/ImagePreview.tsx），平台层只负责通知。
type Presenter = (src: string) => void;

let presenter: Presenter | null = null;

export function setImagePresenter(next: Presenter): () => void {
  presenter = next;
  return () => {
    if (presenter === next) presenter = null;
  };
}

export function presentImage(src: string): boolean {
  if (!presenter) return false;
  presenter(src);
  return true;
}
