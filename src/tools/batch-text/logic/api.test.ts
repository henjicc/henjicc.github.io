import { describe, expect, it, vi } from "vitest";
import { ApiError, checkBaseUrl, combineSignals, describeError, isValidApiKey, normalizeBaseUrl, redactKey, requestChat, testConnection, TimeoutError } from "./api";

const config = { baseUrl: "https://llm.example.test/v1/", model: " demo-model " };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("checkBaseUrl", () => {
  const https = true;
  it("HTTPS 页面上拦下 HTTP 地址", () => {
    expect(checkBaseUrl("http://192.168.1.20:8000/v1", https)).toBe("insecure");
    expect(checkBaseUrl("http://llm.example.test/v1", https)).toBe("insecure");
  });

  it("回环地址和 HTTP 页面不拦", () => {
    expect(checkBaseUrl("http://localhost:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://127.0.0.1:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://[::1]:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://127.8.9.10:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://127.1:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://models.localhost/v1", https)).toBeNull();
    expect(checkBaseUrl("http://192.168.1.20:8000/v1", false)).toBeNull();
    expect(checkBaseUrl("https://llm.example.test/v1", https)).toBeNull();
  });

  it("空的和不是网址的", () => {
    expect(checkBaseUrl("  ", https)).toBe("empty");
    expect(checkBaseUrl("llm.example.test/v1", https)).toBe("invalid");
    expect(checkBaseUrl("ftp://llm.example.test", https)).toBe("invalid");
  });

  it("看起来像回环地址的公网域名照样拦", () => {
    expect(checkBaseUrl("http://127.0.0.1.example.test/v1", https)).toBe("insecure");
    expect(checkBaseUrl("http://localhost.example.test/v1", https)).toBe("insecure");
  });
});

describe("requestChat", () => {
  it("POST 到 /chat/completions，带上密钥、模型和 signal，取第一条回复", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: "改好了" } }] }));
    const signal = new AbortController().signal;
    const out = await requestChat(fetchFn, config, "sk-fictional", [{ role: "user", content: "hi" }], { signal });
    expect(out).toBe("改好了");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://llm.example.test/v1/chat/completions");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer sk-fictional");
    expect(JSON.parse(init?.body as string)).toMatchObject({ model: "demo-model", temperature: 0.7, max_tokens: 4000 });
  });

  it("非 2xx 抛出带状态码和接口原话的错误", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ error: { message: "invalid api key" } }, 401));
    const err = await requestChat(fetchFn, config, "k", []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(describeError(err)).toBe("接口返回 401，密钥不对或没有权限：invalid api key");
  });

  it("返回里没有回复时说清楚", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ choices: [] }));
    await expect(requestChat(fetchFn, config, "k", [])).rejects.toThrow("没有找到回复");
  });

  it("取消时 fetch 抛出的 AbortError 原样往外抛", async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = requestChat(fetchFn, config, "k", [], { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("接口一直不回时到点放弃，给出超时原因", async () => {
    const fetchFn = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const err = await requestChat(fetchFn, config, "k", [], { signal: new AbortController().signal, timeoutMs: 20 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(describeError(err)).toContain("没有回复");
  });
});

describe("没有 AbortSignal.any 的浏览器（Safari 17.4 以前）", () => {
  function withoutAny(run: () => Promise<void>) {
    return async () => {
      const original = AbortSignal.any;
      // @ts-expect-error 模拟旧浏览器缺这个方法
      delete AbortSignal.any;
      try {
        await run();
      } finally {
        AbortSignal.any = original;
      }
    };
  }

  it(
    "请求照常发出，用户停止仍抛 AbortError",
    withoutAny(async () => {
      const fetchFn = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: "好" } }] }));
      await expect(requestChat(fetchFn, config, "k", [], { signal: new AbortController().signal })).resolves.toBe("好");

      const controller = new AbortController();
      const hanging = vi.fn<typeof fetch>(
        (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
      );
      const pending = requestChat(hanging, config, "k", [], { signal: controller.signal });
      controller.abort(new DOMException("stop", "AbortError"));
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    }),
  );

  it(
    "超时仍给出超时原因",
    withoutAny(async () => {
      const hanging = vi.fn<typeof fetch>(
        (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
      );
      const err = await requestChat(hanging, config, "k", [], { signal: new AbortController().signal, timeoutMs: 20 }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TimeoutError);
    }),
  );
});

describe("combineSignals 的转发实现", () => {
  it("任一信号中止时带着它的 reason 中止，并移除所有监听", () => {
    const a = new AbortController();
    const b = new AbortController();
    const removeA = vi.spyOn(a.signal, "removeEventListener");
    const removeB = vi.spyOn(b.signal, "removeEventListener");
    const { signal } = combineSignals([a.signal, b.signal], null);
    expect(signal.aborted).toBe(false);
    b.abort("原因B");
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe("原因B");
    expect(removeA).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(removeB).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("dispose 后另一个信号再中止也不影响", () => {
    const a = new AbortController();
    const { signal, dispose } = combineSignals([a.signal], null);
    dispose();
    a.abort();
    expect(signal.aborted).toBe(false);
  });

  it("传入时已有信号中止就直接中止", () => {
    const a = new AbortController();
    a.abort("早就停了");
    const { signal } = combineSignals([a.signal, new AbortController().signal], null);
    expect(signal.reason).toBe("早就停了");
  });
});

describe("testConnection", () => {
  it("GET /models，2xx 算通", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ data: [] }));
    await testConnection(fetchFn, { baseUrl: "https://llm.example.test/v1" }, "k");
    expect(fetchFn.mock.calls[0]![0]).toBe("https://llm.example.test/v1/models");
    fetchFn.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(testConnection(fetchFn, { baseUrl: "https://llm.example.test/v1" }, "k")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("describeError", () => {
  it("网络或跨域失败给出可能的原因", () => {
    expect(describeError(new TypeError("Failed to fetch"))).toContain("不允许从浏览器直接访问");
  });

  it("接口把密钥写进报错时遮住", () => {
    const err = new ApiError(401, "Incorrect API key provided: sk-fictional-abc123");
    expect(describeError(err, " sk-fictional-abc123 ")).toBe("接口返回 401，密钥不对或没有权限：Incorrect API key provided: ***");
    expect(redactKey("无关的文字", "")).toBe("无关的文字");
  });
});

it("密钥只能是可见的 ASCII 字符", () => {
  expect(isValidApiKey("sk-fictional_AZ.09")).toBe(true);
  expect(isValidApiKey("sk-fictional 123")).toBe(false);
  expect(isValidApiKey("sk-假的")).toBe(false);
  expect(isValidApiKey("sk-ｆｕｌｌ")).toBe(false);
  expect(isValidApiKey("")).toBe(false);
});

it("normalizeBaseUrl 去掉空白和末尾斜杠", () => {
  expect(normalizeBaseUrl(" https://a.example.test/v1// ")).toBe("https://a.example.test/v1");
});
