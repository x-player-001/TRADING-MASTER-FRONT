// ===== 大周期分桶 =====
// 默认按 UTC 整点分桶（币安、GC）：桶起点 = floor(open_time / 周期) × 周期。
// ES 只下发美股常规时段（美东 09:30~16:00，夏令时自动处理），大周期从开盘起算、收盘截断：
//   1h = 9:30、10:30…15:30（15:30 那根只有半小时），4h = 9:30~13:30、13:30~16:00。

interface RegularSession {
  timeZone: string;
  open: number;  // 当地时间，距 0 点的分钟数
  close: number;
}

const REGULAR_SESSIONS: Record<string, RegularSession> = {
  ES: { timeZone: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 },
};

export const regularSessionOf = (symbol: string | null | undefined): RegularSession | null =>
  (symbol && REGULAR_SESSIONS[symbol]) || null;

export interface Bucket {
  start: number;
  /** 不含：桶内最后一根 5m 的 open_time + 5m === end 即为收盘 */
  end: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterOf = (timeZone: string) => {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
};

/** ms 所在当地日的 0 点（UTC 毫秒），按该时刻的时区偏移换算 */
const localMidnight = (ms: number, timeZone: string): number => {
  const parts: Record<string, number> = {};
  for (const p of formatterOf(timeZone).formatToParts(ms)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const offset = asUtc - Math.floor(ms / 60_000) * 60_000; // 当地时间 − UTC
  return Date.UTC(parts.year, parts.month - 1, parts.day) - offset;
};

export const bucketOf = (openTime: number, intervalMs: number, session: RegularSession | null): Bucket => {
  if (session) {
    const midnight = localMidnight(openTime, session.timeZone);
    const open = midnight + session.open * 60_000;
    const close = midnight + session.close * 60_000;
    if (openTime >= open && openTime < close) {
      const start = open + Math.floor((openTime - open) / intervalMs) * intervalMs;
      return { start, end: Math.min(start + intervalMs, close) };
    }
    // 不在常规时段内（理论上不会下发），退回 UTC 分桶
  }
  const start = Math.floor(openTime / intervalMs) * intervalMs;
  return { start, end: start + intervalMs };
};
