import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 让 tailwind-merge 认得雾林的字号刻度，否则 text-ui 和 text-ink 会被当成同一组互相覆盖。
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["hero", "display", "title-1", "title-2", "title-3", "body-lg", "body", "ui", "caption", "micro", "stat", "timecode", "keycap"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
