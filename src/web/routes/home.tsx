import { HomePage } from "~/pages/HomePage";
import type { ShellHandle } from "~/shell/handle";
import { pageMeta } from "~/shell/meta";

export const meta = () => pageMeta({});
export const handle: ShellHandle = { header: "scene" };

export default function Home() {
  return <HomePage />;
}
