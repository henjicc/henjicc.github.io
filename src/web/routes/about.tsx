import { videoFile } from "~/content/video-data";
import { AboutPage } from "~/pages/AboutPage";
import { pageMeta } from "~/shell/meta";
import type { Route } from "./+types/about";

export const meta = () => pageMeta({ title: "关于" });

export function loader() {
  return { profile: videoFile.profile };
}

export default function About({ loaderData }: Route.ComponentProps) {
  return <AboutPage profile={loaderData.profile} />;
}
