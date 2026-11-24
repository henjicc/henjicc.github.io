import { Dialog, DialogContent, DialogTitle } from "~/ui/dialog";

// 存不了相册时（TOY 预览、App 外打开）把图片显示出来，让访客长按保存。按需加载。
export default function ImagePreview({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[min(560px,calc(100%-32px))]">
        <DialogTitle>长按图片保存</DialogTitle>
        <img src={src} alt="" className="block max-h-[70dvh] w-full rounded-md object-contain" />
      </DialogContent>
    </Dialog>
  );
}
