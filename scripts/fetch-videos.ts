// 拉取 B 站频道的最新视频和数据，写入 src/content/videos.json（结构见 src/content/schema.ts）。
//
//   npm run videos                  手动拉取并覆盖快照（之后自己看 diff、提交）
//   node scripts/fetch-videos.ts --ci   build:web 里调用：只在 Cloudflare Pages 构建（CF_PAGES=1）时拉取，本地构建直接跳过
//
// 失败策略：任何一步失败（网络、风控、接口改字段、校验不过）都不动现有文件。--ci 时退出码为 0，
// 构建照常用仓库里提交的快照；手动运行时退出码为 1。不使用任何登录 cookie。
//
// 接口（2026-11-24 实测，都不需要登录和签名）：
//   视频列表  GET https://api.bilibili.com/x/series/recArchivesByKeywords?mid=&keywords=&ps=<=100&pn=
//             要浏览器 UA + Referer，否则基本必 412；带上也会随机 412，靠退避重试。
//   粉丝获赞  GET https://api.bilibili.com/x/web-interface/card?mid=
// 总播放量没有免登录接口，把视频列表逐页的播放量累加（个别稿件会被过滤，所以是近似值）。
// 需要 WBI 签名的 space/wbi/arc/search 不带登录 cookie 时实测返回 -352，没有用。
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { videosFileSchema, type VideosFile } from "../src/content/schema.ts";

const MID = 39337803;
const LIMIT = 30;
const PAGE_SIZE = 100; // 接口上限，再大返回 -400
const OUT = fileURLToPath(new URL("../src/content/videos.json", import.meta.url));

const ci = process.argv.includes("--ci");
const log = (msg: string) => console.log(`[fetch-videos] ${msg}`);

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: `https://space.bilibili.com/${MID}`,
  Origin: "https://space.bilibili.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

/** 风控或临时错误的业务码，可以重试。 */
const RETRY_CODES = new Set([-352, -412, -799, -509, -500, -503]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shortUrl = (u: string) => u.replace(/^https:\/\/api\.bilibili\.com/, "").replace(/\?.*$/, "");

let lastRequestAt = 0;

async function getData<T>(url: string, attempts = 6): Promise<T> {
  let lastErr = "";
  for (let i = 0; i < attempts; i++) {
    // 请求之间至少隔 1.2 秒：连续密集请求时 412 明显变多
    const wait = lastRequestAt + 1200 - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      if (res.status !== 200) {
        lastErr = `HTTP ${res.status}`;
        if (res.status !== 412 && res.status !== 429 && res.status < 500) break;
      } else {
        const body = JSON.parse(text) as { code: number; message?: string; data: T };
        if (body.code === 0) return body.data;
        lastErr = `code ${body.code} ${body.message ?? ""}`.trim();
        if (!RETRY_CODES.has(body.code)) break;
      }
    } catch (e) {
      lastErr = (e as Error).message;
    }
    if (i < attempts - 1) {
      const backoff = 2000 * 2 ** i + Math.random() * 1000;
      log(`${shortUrl(url)} -> ${lastErr}，${Math.round(backoff / 1000)} 秒后重试（${i + 1}/${attempts - 1}）`);
      await sleep(backoff);
    }
  }
  throw new Error(`${shortUrl(url)} 失败：${lastErr}`);
}

type RawArchive = { bvid: string; title: string; pic: string; duration: number; pubdate: number; stat?: { view?: number } };
type ArchivePage = { archives?: RawArchive[]; page?: { total?: number } };
type Card = { follower?: number; like_num?: number };

const https = (u: string) => u.replace(/^http:\/\//, "https://");

async function archivePage(pn: number) {
  const data = await getData<ArchivePage>(
    `https://api.bilibili.com/x/series/recArchivesByKeywords?mid=${MID}&keywords=&ps=${PAGE_SIZE}&pn=${pn}`,
  );
  return { archives: data.archives ?? [], total: data.page?.total ?? 0 };
}

const sumViews = (list: RawArchive[]) => list.reduce((s, a) => s + Number(a.stat?.view ?? 0), 0);

async function fetchAll(previous: VideosFile | null): Promise<unknown> {
  const card = await getData<Card>(`https://api.bilibili.com/x/web-interface/card?mid=${MID}`);
  const first = await archivePage(1);

  // 播放合计要把剩下的页也拉完；中途失败就沿用上一次的值
  let totalViews: number | null;
  try {
    let sum = sumViews(first.archives);
    for (let pn = 2; pn <= Math.ceil(first.total / PAGE_SIZE); pn++) sum += sumViews((await archivePage(pn)).archives);
    totalViews = sum;
  } catch (e) {
    log(`播放合计没拉全（${(e as Error).message}），沿用上一次的值`);
    totalViews = previous?.profile.totalViews ?? null;
  }

  const videos = first.archives
    .map((a) => ({
      bvid: a.bvid,
      title: a.title,
      cover: https(a.pic),
      duration: Number(a.duration),
      views: Number(a.stat?.view ?? 0),
      publishedAt: new Date(a.pubdate * 1000).toISOString(),
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, LIMIT);

  return {
    fetchedAt: new Date().toISOString(),
    // 卡片接口还返回头像、简介等资料；简介里有联系方式，只取页面用到的数字
    profile: { followers: card.follower, likes: card.like_num, totalViews },
    videos,
  };
}

async function readPrevious(): Promise<VideosFile | null> {
  try {
    return videosFileSchema.parse(JSON.parse(await readFile(OUT, "utf8")));
  } catch {
    return null;
  }
}

async function main() {
  if (ci && process.env.CF_PAGES !== "1") {
    log("不是 Cloudflare Pages 构建，跳过拉取，用仓库里的快照");
    return;
  }
  const previous = await readPrevious();
  log(`开始拉取（现有快照拉取于 ${previous?.fetchedAt ?? "无"}）`);
  // parse 会去掉结构里没登记的字段
  const data = videosFileSchema.parse(await fetchAll(previous));
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmp, OUT);
  const p = data.profile;
  log(`已写入 ${data.videos.length} 个视频；粉丝 ${p.followers}，获赞 ${p.likes}，播放合计 ${p.totalViews ?? "未知"}`);
}

main().catch(async (e: unknown) => {
  const previous = await readPrevious();
  log(`拉取失败：${e instanceof Error ? e.message : String(e)}`);
  log(previous ? `沿用仓库里的快照（拉取于 ${previous.fetchedAt}）` : "现有快照也读不出来，构建会在校验时报错");
  process.exitCode = ci ? 0 : 1;
});
