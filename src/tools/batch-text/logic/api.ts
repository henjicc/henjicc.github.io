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
  insecure:
    "浏览器会拦下这个网页对 HTTP 地址的请求，请换成 HTTPS 地址。本机服务可以用 http://localhost 或 http://127.0.0.1，Chrome 和 Firefox 能用，Safari 可能仍会拦下",
};

/** 浏览器当作“可信来源”的回环地址：localhost 及其子域、整个 127.0.0.0/8、[::1]。URL 已经把 127.1 这类简写规范成四段。 */
export function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/**
 * 安全上下文（HTTPS 页面）请求 HTTP 地址属于混合内容，浏览器直接拦下，请求根本发不出去。
 * 回环地址例外：Chrome 和 Firefox 把它当作可信来源放行。Safari 对 http://localhost 的处理没能核实，所以提示里不打包票。
 * secureContext 传 window.isSecureContext；本地开发的 http://localhost 页面也算安全上下文，会多拦一些其实能发的地址，只影响开发。
 */
export function checkBaseUrl(url: string, secureContext: boolean): EndpointProblem | null {
  const value = normalizeBaseUrl(url);
  if (!value) return "empty";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "invalid";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "invalid";
  if (parsed.protocol === "http:" && secureContext && !isLoopbackHost(parsed.hostname)) return "insecure";
  return null;
}

/**
 * 请求头只能放可见的 ASCII 字符。密钥里混进空格、换行或全角字符时 fetch 直接抛 TypeError，
 * 界面上只会显示成“连不上接口”，所以发请求前先查。
 */
export function isValidApiKey(key: string): boolean {
  return /^[\x21-\x7e]+$/.test(key);
}

export const INVALID_KEY_MESSAGE = "接口密钥里有空格、中文或其他不能用的字符，检查是不是复制多了";

/** 接口报错时可能把收到的密钥原样写进错误信息，显示前把它遮住。 */
export function redactKey(text: string, apiKey: string): string {
  const key = apiKey.trim();
  return key ? text.replaceAll(key, "***") : text;
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

/** 对话请求最长等 2 分钟：长文本生成通常在这之内，接口卡住时不让这个文件一直占着并发名额。 */
export const CHAT_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 20_000;

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`接口 ${Math.round(ms / 1000)} 秒没有回复，已放弃`);
    this.name = "TimeoutError";
  }
}

/**
 * 任一信号中止时中止，并带上它的 reason。AbortSignal.any 要 Safari 17.4+，更早的 Safari 上直接调用会抛 TypeError，
 * 界面只会显示成“连不上接口”，所以缺失时手动转发。dispose 移除转发用的监听：用户的停止信号会跨多个请求存活，不移除会越积越多。
 */
export function combineSignals(
  signals: AbortSignal[],
  any: ((signals: AbortSignal[]) => AbortSignal) | null = AbortSignal.any?.bind(AbortSignal) ?? null,
): { signal: AbortSignal; dispose: () => void } {
  if (any) return { signal: any(signals), dispose: () => {} };
  const controller = new AbortController();
  const dispose = () => {
    for (const s of signals) s.removeEventListener("abort", onAbort);
  };
  function onAbort(this: AbortSignal) {
    dispose();
    controller.abort(this.reason);
  }
  const already = signals.find((s) => s.aborted);
  if (already) {
    controller.abort(already.reason);
  } else {
    for (const s of signals) s.addEventListener("abort", onAbort);
  }
  return { signal: controller.signal, dispose };
}

/** 停止信号和超时合在一起传给 fetch；超时抛 TimeoutError，用户停止仍抛 AbortError。 */
async function withTimeout<T>(ms: number, signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const timeout = AbortSignal.timeout(ms);
  const combined = signal ? combineSignals([signal, timeout]) : { signal: timeout, dispose: () => {} };
  try {
    return await run(combined.signal);
  } catch (e) {
    if (timeout.aborted && !signal?.aborted) throw new TimeoutError(ms);
    throw e;
  } finally {
    combined.dispose();
  }
}

/** 不流式，取 choices[0].message.content。signal 一直传到 fetch：停止时正在发的请求会被真正取消。读回复体也算在超时里。 */
export async function requestChat(
  fetchFn: Fetch,
  config: Pick<ApiConfig, "baseUrl" | "model">,
  apiKey: string,
  messages: ChatMessage[],
  { signal, timeoutMs = CHAT_TIMEOUT_MS }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  return withTimeout(timeoutMs, signal, async (combined) => {
    const res = await fetchFn(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({ model: config.model.trim(), messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS }),
      signal: combined,
    });
    if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
    let data: { choices?: { message?: { content?: unknown } }[] };
    try {
      data = (await res.json()) as typeof data;
    } catch (e) {
      if (combined.aborted) throw e;
      throw new Error("接口返回的不是 JSON，检查接口地址是不是写到了 /v1 这一级", { cause: e });
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("接口返回的内容里没有找到回复");
    return content;
  });
}

/** 测试连接：GET /models 返回 2xx 就算通。 */
export async function testConnection(
  fetchFn: Fetch,
  config: Pick<ApiConfig, "baseUrl">,
  apiKey: string,
  timeoutMs = TEST_TIMEOUT_MS,
): Promise<void> {
  await withTimeout(timeoutMs, undefined, async (signal) => {
    const res = await fetchFn(`${normalizeBaseUrl(config.baseUrl)}/models`, { method: "GET", headers: headers(apiKey), signal });
    if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
  });
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** 给用户看的失败原因。传入 apiKey 时把错误里出现的密钥遮住。 */
export function describeError(error: unknown, apiKey = ""): string {
  return redactKey(errorText(error), apiKey);
}

function errorText(error: unknown): string {
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
