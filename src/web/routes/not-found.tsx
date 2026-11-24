import { NotFoundPage } from "~/pages/NotFoundPage";
import type { ShellHandle } from "~/shell/handle";
import { pageMeta } from "~/shell/meta";

export const meta = () => pageMeta({ title: "找不到这个页面" });
export const handle: ShellHandle = { header: "scene", footer: false };

export default function NotFound() {
  return <NotFoundPage />;
}
