import { FolderOpen, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "~/ui/button";
import { cn } from "~/ui/lib/utils";

type FileDropProps = {
  onFiles: (files: File[]) => void;
  /** 如 "image/*"。 */
  accept?: string;
  multiple?: boolean;
  title?: string;
  action?: string;
  /** 不知道就选不对的格式限制，如“JPG、PNG、WebP，单张不超过 20MB”。 */
  formats?: string;
  /** 由外部（整页拖放）控制的拖入状态。 */
  over?: boolean;
  className?: string;
};

// 取景框是唯一的母题：拖入文件时四角向内收，不用虚线框。
function FileDrop({ onFiles, accept, multiple, title = "把图片拖到这里", action = "打开图片", formats, over, className }: FileDropProps) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isOver = over ?? dragging;
  return (
    <div
      data-over={isOver}
      className={cn(
        "vf grid min-h-60 content-center justify-items-center gap-3 rounded-lg bg-surface-sunken px-6 py-10 text-center transition-shadow duration-(--dur-base) ease-out data-[over=true]:shadow-glow",
        className,
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <span className="grid size-12 place-items-center rounded-md bg-sky-soft text-sky-text">
        <Upload aria-hidden className="size-[22px]" />
      </span>
      <p className="m-0 text-[17px] leading-[1.4] font-semibold">{title}</p>
      <Button size="sm" onClick={() => input.current?.click()}>
        <FolderOpen aria-hidden />
        {action}
      </Button>
      {formats ? <p className="m-0 text-caption text-ink-muted">{formats}</p> : null}
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

export { FileDrop };
