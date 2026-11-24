import { describe, expect, it } from "vitest";
import { runPool } from "./pool";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("runPool", () => {
  it("一个完成就接下一个，不等同批里最慢的", async () => {
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];
    const run = runPool([0, 1, 2], async (i) => {
      started.push(i);
      await gates[i]!.promise;
    }, { concurrency: 2, signal: new AbortController().signal });
    await tick();
    expect(started).toEqual([0, 1]);
    gates[1]!.resolve(); // 0 还在跑
    await tick();
    expect(started).toEqual([0, 1, 2]);
    gates[0]!.resolve();
    gates[2]!.resolve();
    await run;
  });

  it("同时在跑的数量不超过并发数", async () => {
    let active = 0;
    let peak = 0;
    await runPool(Array.from({ length: 9 }, (_, i) => i), async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
    }, { concurrency: 3, signal: new AbortController().signal });
    expect(peak).toBe(3);
  });

  it("取消后不再领新任务", async () => {
    const controller = new AbortController();
    const seen: number[] = [];
    await runPool([0, 1, 2, 3], async (i) => {
      seen.push(i);
      if (i === 1) controller.abort();
      await tick();
    }, { concurrency: 2, signal: controller.signal });
    expect(seen).toEqual([0, 1]);
  });
});
