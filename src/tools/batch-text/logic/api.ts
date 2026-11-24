import type { ChatMessage } from "./prompt";

export type ApiConfig = {
  id: string;
  name: string;
  /** OpenAI 兼容接口的根地址，如 https://api.openai.com/v1。 */
  baseUrl: string;
  model: string;
};

// 沿用旧版写死的参数，没有界面可改。
const TEMPERATURE = 0.7;
const MAX_TOKENS = 4000;

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export type EndpointProblem = "empty" | "invalid" | "insecure";

export const ENDPOINT_MESSAGES: Record<EndpointProblem, string> = {
  empty: "接口地址还没填",
  invalid: "接口地址要以 https:// 开头",
  insecure: "浏览器会拦下 HTTPS 网页对 HTTP 地址的请求。换成 HTTPS 地址，本机服务可以用 http://localhost",
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * HTTPS 页面请求 HTTP 地址属于混合内容，浏览器直接拦下，请求根本发不出去。
 * 回环地址例外：Chrome 和 Firefox 把 http://localhost 当作安全来源，本机跑的模型服务能用。
 */
export function checkBaseUrl(url: string, pageOrigin: string): EndpointProblem | null {
  const value = normalizeBaseUrl(url);
  if (!value) return "empty";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "invalid";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "invalid";
  const host = parsed.hostname;
  const loopback = LOOPBACK.has(host) || host.endsWith(".localhost");
  if (parsed.protocol === "http:" && pageOrigin.startsWith("https:") && !loopback) return "insecure";
  return null;
}

function headers(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } | string; message?: unknown };
    const msg = typeof body.error === "string" ? body.error : (body.error?.message ?? body.message);
    return typeof msg === "string" ? msg.slice(0, 300) : "";
  } catch {
    return "";
  }
}

type Fetch = typeof fetch;

/** 不流式，取 choices[0].message.content。signal 一直传到 fetch：停止时正在发的请求会被真正取消。 */
export async function requestChat(
  fetchFn: Fetch,
  config: Pick<ApiConfig, "baseUrl" | "model">,
  apiKey: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetchFn(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ model: config.model.trim(), messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS }),
    signal,
  });
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
  let data: { choices?: { message?: { content?: unknown } }[] };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error("接口返回的不是 JSON，检查接口地址是不是写到了 /v1 这一级");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("接口返回的内容里没有找到回复");
  return content;
}

/** 测试连接：GET /models 返回 2xx 就算通。 */
export async function testConnection(fetchFn: Fetch, config: Pick<ApiConfig, "baseUrl">, apiKey: string): Promise<void> {
  const res = await fetchFn(`${normalizeBaseUrl(config.baseUrl)}/models`, { method: "GET", headers: headers(apiKey) });
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** 给用户看的失败原因。 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const hint =
      error.status === 401 || error.status === 403
        ? "密钥不对或没有权限"
        : error.status === 404
          ? "接口地址或模型名不对"
          : error.status === 429
            ? "请求太频繁或额度用完了"
            : "";
    const parts = [hint, error.message].filter(Boolean).join("：");
    return `接口返回 ${error.status}${parts ? `，${parts}` : ""}`;
  }
  // fetch 在网络不通、地址解析失败、对方不允许跨域时都只抛 TypeError，浏览器不告诉页面是哪一种
  if (error instanceof TypeError) return "连不上接口。检查地址和网络；也可能是这个服务不允许从浏览器直接访问";
  if (error instanceof Error && error.message) return error.message;
  return "处理失败";
}
