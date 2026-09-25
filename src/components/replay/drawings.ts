import type { ReplayBar } from '../../services/replayAPI';

// ===== K线回放画线 =====
// 锚点存「毫秒时间 + 价格」而不是图表坐标或K线序号：
// 切换周期（5m↔1h）后同一时间点落在不同序号上，按时间存才能保持位置不变。

export type DrawingTool = 'select' | 'hline' | 'trend' | 'channel' | 'rect' | 'fib';

export interface Anchor {
  t: number; // 毫秒时间戳（可以落在两根K线之间，或未来尚未揭示的位置）
  p: number; // 价格
}

export type Drawing =
  | { id: string; type: 'hline'; p: number; color: string }
  | { id: string; type: 'trend'; a: Anchor; b: Anchor; color: string }
  // 平行通道：a→b 是基准线，另一条线是基准线整体平移 dp（价格差）
  | { id: string; type: 'channel'; a: Anchor; b: Anchor; dp: number; color: string }
  | { id: string; type: 'rect'; a: Anchor; b: Anchor; color: string }
  // 斐波那契：a（第一下，波段起点）为 0、b（第二下，波段终点）为 1，1.5 / 2 顺着波段方向向外延伸
  | { id: string; type: 'fib'; a: Anchor; b: Anchor; color: string };

/** 斐波那契档位：0~1 在波段内，1.5、2 为越过终点的延伸目标 */
export const FIB_LEVELS = [0, 0.5, 1, 1.5, 2];

/** 档位对应价格：0 在 a，1 在 b */
export const fibPrice = (a: Anchor, b: Anchor, level: number) => a.p + (b.p - a.p) * level;

/** 命中的部位：端点 a / 端点 b / 通道宽度手柄 c / 整体 */
export type HitPart = 'a' | 'b' | 'c' | 'body';

export const DRAWING_COLORS = ['#f59e0b', '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#94a3b8'];

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * 时间 ↔ 逻辑序号（可带小数）换算。
 * 区间内按相邻两根K线线性插值（跨数据缺口也连续）；区间外按周期长度外推。
 */
export class TimeMapper {
  private bars: ReplayBar[];
  private intervalMs: number;

  constructor(bars: ReplayBar[], intervalMs: number) {
    this.bars = bars;
    this.intervalMs = intervalMs;
  }

  get empty() {
    return this.bars.length === 0;
  }

  toLogical(t: number): number | null {
    const bars = this.bars;
    const n = bars.length;
    if (n === 0) return null;
    const first = bars[0].open_time;
    const last = bars[n - 1].open_time;
    if (t <= first) return (t - first) / this.intervalMs;
    if (t >= last) return n - 1 + (t - last) / this.intervalMs;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (bars[mid].open_time <= t) lo = mid;
      else hi = mid;
    }
    const span = bars[hi].open_time - bars[lo].open_time || this.intervalMs;
    return lo + (t - bars[lo].open_time) / span;
  }

  toTime(logical: number): number | null {
    const bars = this.bars;
    const n = bars.length;
    if (n === 0) return null;
    if (logical <= 0) return bars[0].open_time + logical * this.intervalMs;
    if (logical >= n - 1) return bars[n - 1].open_time + (logical - (n - 1)) * this.intervalMs;
    const i = Math.floor(logical);
    const frac = logical - i;
    return bars[i].open_time + frac * (bars[i + 1].open_time - bars[i].open_time);
  }
}

/** 点到线段的距离（像素） */
export const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const k = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + k * dx), py - (y1 + k * dy));
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

// ── 本地持久化：后端没有画线接口，先按会话存浏览器 ──
const storageKeyOf = (sessionKey: string) => `replay.drawings.${sessionKey}`;

export const loadDrawings = (sessionKey: string): Drawing[] => {
  try {
    const raw = localStorage.getItem(storageKeyOf(sessionKey));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveDrawings = (sessionKey: string, list: Drawing[]) => {
  try {
    if (list.length) localStorage.setItem(storageKeyOf(sessionKey), JSON.stringify(list));
    else localStorage.removeItem(storageKeyOf(sessionKey));
  } catch {
    /* 隐私模式等场景写不进去，忽略 */
  }
};
