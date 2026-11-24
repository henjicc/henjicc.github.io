/**
 * 任务池：始终保持 concurrency 个任务在跑，一个完成就立刻接下一个，不等同一批里最慢的那个。
 * signal 取消后不再领新任务；正在跑的任务自己负责响应 signal（把它传给 fetch）。
 * worker 抛出的错误要自己处理，这里不吞也不重试。
 */
export async function runPool<T>(
  items: readonly T[],
  worker: (item: T, signal: AbortSignal) => Promise<void>,
  { concurrency, signal }: { concurrency: number; signal: AbortSignal },
): Promise<void> {
  let next = 0;
  async function lane() {
    while (!signal.aborted && next < items.length) {
      const item = items[next++] as T;
      await worker(item, signal);
    }
  }
  const lanes = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  await Promise.all(Array.from({ length: lanes }, lane));
}
