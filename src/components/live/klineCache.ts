/**
 * 实时看盘的 K 线内存缓存 + 后台预拉
 *
 * - 缓存：模块级，跨页面切换也保留。切回来先画缓存，再用 start_time=最后一根 补拉中间缺的 K 线
 * - 预拉：打开页面后把侧栏列表里的币按 PREFETCH_INTERVALS 各拉一页，点开时直接命中缓存
 *
 * 权重：币安 K 线接口 limit 100~499 算 2，500~1000 算 5，所以一页取 499。
 * 预拉按 PREFETCH_WEIGHT_PER_MIN 限速，遇到 429 整个队列按 Retry-After 暂停，不挤占实盘的额度。
 */
import {
  fetchRelayKlines,
  INTERVAL_MS,
  RelayHttpError,
  RelayInterval,
  RelayKline,
} from '../../services/marketRelayAPI';

export const PAGE_SIZE = 499;

/** 侧栏全部列表去重后约 70 个币 × 4 个周期，再留些给手动切换的 */
const CACHE_MAX_ENTRIES = 320;
/** 缓存落后超过这么多根就不补拉了，直接重新拉最新一页 */
const CACHE_MAX_GAP_BARS = 1000;
const barCache = new Map<string, { bars: RelayKline[]; exhausted: boolean }>();

export const cacheKeyOf = (symbol: string, interval: RelayInterval) => `${symbol}|${interval}`;

export const cacheGet = (key: string, interval: RelayInterval) => {
  const hit = barCache.get(key);
  if (!hit) return null;
  const last = hit.bars[hit.bars.length - 1];
  if (!last || Date.now() - last.open_time > INTERVAL_MS[interval] * CACHE_MAX_GAP_BARS) {
    barCache.delete(key);
    return null;
  }
  return hit;
};

export const cacheSet = (key: string, bars: RelayKline[], exhausted: boolean) => {
  if (bars.length === 0) return;
  barCache.delete(key); // 重新插入，Map 的顺序即最近使用顺序
  barCache.set(key, { bars, exhausted });
  while (barCache.size > CACHE_MAX_ENTRIES) barCache.delete(barCache.keys().next().value!);
};

// ── 后台预拉 ──

export const PREFETCH_INTERVALS: RelayInterval[] = ['5m', '15m', '1h', '4h'];
/** 每分钟最多花多少权重（服务器超过 1500 就拒绝，trend / live 也要用） */
const PREFETCH_WEIGHT_PER_MIN = 300;
const WEIGHT_PER_PAGE = 2;
const PREFETCH_GAP_MS = (60_000 / PREFETCH_WEIGHT_PER_MIN) * WEIGHT_PER_PAGE;
const PREFETCH_CONCURRENCY = 2;

interface Job {
  symbol: string;
  interval: RelayInterval;
}

let queue: Job[] = [];
let active = 0;
let nextStartAt = 0;
let timer: number | null = null;
/** 正在看的那一个由图表自己拉，预拉跳过 */
let skipKey = '';
const inflight = new Set<string>();

const schedule = (delay: number) => {
  if (timer !== null) return;
  timer = window.setTimeout(() => {
    timer = null;
    pump();
  }, Math.max(0, delay));
};

const pump = () => {
  while (active < PREFETCH_CONCURRENCY && queue.length > 0) {
    const wait = nextStartAt - Date.now();
    if (wait > 0) {
      schedule(wait);
      return;
    }
    const job = queue.shift()!;
    const key = cacheKeyOf(job.symbol, job.interval);
    if (key === skipKey || inflight.has(key) || cacheGet(key, job.interval)) continue;

    active += 1;
    inflight.add(key);
    nextStartAt = Date.now() + PREFETCH_GAP_MS;
    fetchRelayKlines({ symbol: job.symbol, interval: job.interval, limit: PAGE_SIZE }, 0)
      .then((page) => {
        // 拉取期间图表可能已经写过更完整的数据，不覆盖
        if (!barCache.has(key)) cacheSet(key, page, page.length < PAGE_SIZE);
      })
      .catch((err) => {
        if (err instanceof RelayHttpError && err.status === 429) {
          queue.unshift(job);
          nextStartAt = Date.now() + err.retryAfterMs;
        }
        // 其它错误（下架、拼错的币）直接跳过
      })
      .finally(() => {
        active -= 1;
        inflight.delete(key);
        pump();
      });
  }
};

/**
 * 设置预拉目标（整体替换队列，已缓存的自动跳过）。
 * 顺序：先拉正在看的币的其余周期（最可能马上切），再把所有币的当前周期拉完，最后拉其余周期。
 */
export const setPrefetchTargets = (symbols: string[], current: { symbol: string; interval: RelayInterval }) => {
  skipKey = cacheKeyOf(current.symbol, current.interval);
  const others = PREFETCH_INTERVALS.filter((iv) => iv !== current.interval);
  const intervals = [...PREFETCH_INTERVALS.filter((iv) => iv === current.interval), ...others];
  queue = [
    ...others.map((interval) => ({ symbol: current.symbol, interval })),
    ...intervals.flatMap((interval) => symbols.map((symbol) => ({ symbol, interval }))),
  ];
  pump();
};

export const stopPrefetch = () => {
  queue = [];
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
};
