import { AboutPage } from "~/pages/AboutPage";
import { pageMeta } from "~/shell/meta";

export const meta = () => pageMeta({ title: "关于" });

export default function About() {
  return <AboutPage />;
}
