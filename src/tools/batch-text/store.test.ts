// @vitest-environment jsdom
import { expect, it } from "vitest";
import { platform } from "~/platform";
import meta from "./meta";
import { useKeys } from "./store";

it("存储里的密钥记录格式不对时照样读完，按没记住处理", async () => {
  await platform.storage.local(meta.id).set("keys", { version: 0 });
  await useKeys.persist.rehydrate();
  expect(useKeys.persist.hasHydrated()).toBe(true);
  expect(useKeys.getState().remember).toBe(false);
});
