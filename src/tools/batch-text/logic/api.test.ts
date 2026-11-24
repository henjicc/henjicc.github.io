import { describe, expect, it, vi } from "vitest";
import { ApiError, checkBaseUrl, describeError, normalizeBaseUrl, requestChat, testConnection } from "./api";

const config = { baseUrl: "https://llm.example.test/v1/", model: " demo-model " };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("checkBaseUrl", () => {
  const https = "https://www.example.com";
  it("HTTPS 页面上拦下 HTTP 地址", () => {
    expect(checkBaseUrl("http://192.168.1.20:8000/v1", https)).toBe("insecure");
    expect(checkBaseUrl("http://llm.example.test/v1", https)).toBe("insecure");
  });

  it("回环地址和 HTTP 页面不拦", () => {
    expect(checkBaseUrl("http://localhost:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://127.0.0.1:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://[::1]:11434/v1", https)).toBeNull();
    expect(checkBaseUrl("http://192.168.1.20:8000/v1", "http://localhost:4173")).toBeNull();
    expect(checkBaseUrl("https://llm.example.test/v1", https)).toBeNull();
  });

  it("空的和不是网址的", () => {
    expect(checkBaseUrl("  ", https)).toBe("empty");
    expect(checkBaseUrl("llm.example.test/v1", https)).toBe("invalid");
    expect(checkBaseUrl("ftp://llm.example.test", https)).toBe("invalid");
  });
});

describe("requestChat", () => {
  it("POST 到 /chat/completions，带上密钥、模型和 signal，取第一条回复", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: "改好了" } }] }));
    const signal = new AbortController().signal;
    const out = await requestChat(fetchFn, config, "sk-fictional", [{ role: "user", content: "hi" }], signal);
    expect(out).toBe("改好了");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://llm.example.test/v1/chat/completions");
    expect(init?.signal).toBe(signal);
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
    const pending = requestChat(fetchFn, config, "k", [], controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
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
});

it("normalizeBaseUrl 去掉空白和末尾斜杠", () => {
  expect(normalizeBaseUrl(" https://a.example.test/v1// ")).toBe("https://a.example.test/v1");
});
