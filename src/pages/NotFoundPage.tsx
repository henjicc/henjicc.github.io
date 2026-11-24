import { Link } from "react-router";
import { Button } from "~/ui/button";
import { sceneStyle } from "./scene";

export function NotFoundPage() {
  return (
    <section className="scene grid min-h-dvh place-items-center px-4 text-center" style={sceneStyle}>
      <div className="grid animate-mist-in justify-items-center gap-4">
        <h1 className="m-0 text-title-1 text-on-scene md:text-display">这里起雾了</h1>
        <p className="m-0 text-body-lg text-on-scene-muted">找不到这个页面</p>
        <Button asChild variant="primary" size="lg" className="mt-4">
          <Link to="/" viewTransition>
            回首页
          </Link>
        </Button>
      </div>
    </section>
  );
}
