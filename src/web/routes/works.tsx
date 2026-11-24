import { WorksPage } from "~/pages/WorksPage";
import { pageMeta } from "~/shell/meta";

export const meta = () => pageMeta({ title: "作品" });

export default function Works() {
  return <WorksPage />;
}
