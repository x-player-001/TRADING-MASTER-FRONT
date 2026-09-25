import dayjs from 'dayjs';

// 价格精度按量级自适应：BTC 两位小数，山寨币多保留几位
export const fmtPrice = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return v.toFixed(digits);
};

export const fmtQty = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return String(Number(v.toFixed(6)));
};

export const fmtUsd = (v: number | null | undefined, withSign = false): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}`;
};

export const fmtPct = (v: number | null | undefined, withSign = true, digits = 2): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
};

export const fmtR = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}R`;
};

// 时间戳是绝对值，dayjs 按浏览器时区（北京时间）显示
export const fmtTime = (ms: number | null | undefined, withYear = true): string => {
  if (!ms) return '—';
  return dayjs(ms).format(withYear ? 'YYYY-MM-DD HH:mm' : 'MM-DD HH:mm');
};

/** 正负着色用的 className 选择：盈利绿、亏损红（加密货币习惯） */
export const pnlSign = (v: number | null | undefined): 'pos' | 'neg' | 'zero' => {
  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return 'zero';
  return v > 0 ? 'pos' : 'neg';
};
