import type { ChanBsp } from '../../services/chanAnalyzeAPI';

/** 1买 / 3卖 */
export const bspLabel = (p: Pick<ChanBsp, 'type' | 'side'>) => `${p.type}${p.side === 'buy' ? '买' : '卖'}`;

/** 价格按量级保留小数：BTC 两位，小币多几位 */
export const formatPrice = (v: number) => {
  if (!Number.isFinite(v)) return '-';
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return v.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
};

/** 本地时间（浏览器时区），YYYY-MM-DD HH:mm */
export const formatTime = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
