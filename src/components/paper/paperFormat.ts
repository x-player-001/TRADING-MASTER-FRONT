import dayjs from 'dayjs';
import type { PaperTradeStatus } from '../../services/paperTradingAPI';

const isNum = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

// 价格精度按量级自适应：山寨币价格可能很小
export const fmtPrice = (v: number | null | undefined): string => {
  if (!isNum(v)) return '—';
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return String(Number(v.toFixed(digits)));
};

export const fmtU = (v: number | null | undefined, withSign = false): string => {
  if (!isNum(v)) return '—';
  return `${withSign && v > 0 ? '+' : ''}${v.toFixed(2)}`;
};

export const fmtR = (v: number | null | undefined): string => {
  if (!isNum(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}R`;
};

/** 0~1 小数 → 百分比 */
export const fmtRate = (v: number | null | undefined): string => (isNum(v) ? `${(v * 100).toFixed(1)}%` : '—');

export const fmtNum = (v: number | null | undefined, digits = 2): string => (isNum(v) ? v.toFixed(digits) : '—');

// 时间戳是绝对值，dayjs 按浏览器时区（北京时间）显示
export const fmtTime = (ms: number | null | undefined, withYear = false): string =>
  ms ? dayjs(ms).format(withYear ? 'YYYY-MM-DD HH:mm' : 'MM-DD HH:mm') : '—';

export const fmtMinutes = (m: number | null | undefined): string => {
  if (!isNum(m)) return '—';
  if (m < 60) return `${Math.round(m)} 分钟`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)} 小时`;
  return `${(m / 60 / 24).toFixed(1)} 天`;
};

/** 盈利绿、亏损红（加密货币习惯），对应样式表里的 .pos / .neg / .zero */
export const pnlClass = (v: number | null | undefined): 'pos' | 'neg' | 'zero' => {
  if (!isNum(v) || v === 0) return 'zero';
  return v > 0 ? 'pos' : 'neg';
};

export const statusColor = (s: PaperTradeStatus): string =>
  ({ pending: 'gold', open: 'processing', closed: 'default', cancelled: 'default', expired: 'default', skipped: 'default' })[s] ?? 'default';
