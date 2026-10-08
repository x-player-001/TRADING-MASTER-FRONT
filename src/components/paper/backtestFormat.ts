import { fmtPrice } from './paperFormat';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 小数 → 百分比（win_rate / pnl_pct / mfe_pct / mae_pct 均为小数） */
export const fmtPct = (v: number | null | undefined, withSign = true, digits = 2): string => {
  if (!isNum(v)) return '—';
  const p = v * 100;
  return `${withSign && p > 0 ? '+' : ''}${p.toFixed(digits)}%`;
};

// features 各策略不同：认识的键给中文名和格式，不认识的原样展示
const FEATURE_LABELS: Record<string, string> = {
  leg_pct: '拉升涨幅',
  leg_bars: '拉升根数',
  leg_max_bar: '最大单根占比',
  impulse_pct: '推动涨幅',
  pre_waves: '前24h推动波',
  retr: '最大回撤',
  push1: '第1推',
  push2: '第2推',
  push3: '第3推',
  box_top: '区间上沿',
  box_low: '区间下沿',
  lamp: '拉升高度',
  dist_to_top: '离上沿',
  cons_bars: '整理根数',
  qv24: '24h成交额',
  lows_rising: '低点抬高',
  lows_flat: '低点持平',
  lows_ge_first: '三推≥一推',
  fill_wait_bars: '等待成交',
  breakout: '突破上沿',
};

// 比例类：后端参数都用小数（如 leg_min_pct = 0.04），|v| ≤ 1 按小数乘 100，否则视为已是百分数
const RATIO_KEYS = new Set(['leg_pct', 'impulse_pct', 'retr', 'dist_to_top', 'leg_max_bar']);
const PRICE_KEYS = new Set(['push1', 'push2', 'push3', 'box_top', 'box_low', 'lamp']);
const BAR_KEYS = new Set(['leg_bars', 'cons_bars', 'fill_wait_bars']);

export const featureLabel = (key: string): string => FEATURE_LABELS[key] ?? key;

export const fmtFeature = (key: string, v: unknown): string => {
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (!isNum(v)) return typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (RATIO_KEYS.has(key) || key.endsWith('_pct')) return `${(Math.abs(v) <= 1 ? v * 100 : v).toFixed(2)}%`;
  if (PRICE_KEYS.has(key)) return fmtPrice(v);
  if (BAR_KEYS.has(key)) return `${v} 根`;
  if (key === 'qv24') return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`;
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
};

/** 参数值展示：数组 / 对象转 JSON，布尔转中文 */
export const fmtParam = (v: unknown): string => {
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
