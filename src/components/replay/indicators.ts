// K线回放指标：只用已揭示的K线计算，不会偷看未来

/** EMA：前 n 根用 SMA 做种子，之后 k = 2/(n+1) 递推；种子之前为 null */
export const calcEMA = (values: number[], n: number): (number | null)[] => {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let prev = values.slice(0, n).reduce((s, v) => s + v, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
};

export interface MacdResult {
  dif: (number | null)[];
  dea: (number | null)[];
  hist: (number | null)[];
}

/** MACD(fast, slow, signal)：DIF = EMA快 − EMA慢，DEA = DIF 的 EMA，柱 = DIF − DEA（TradingView 口径，不乘 2） */
export const calcMACD = (closes: number[], fast = 12, slow = 26, signal = 9): MacdResult => {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const dif = closes.map((_, i) => (emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i]! - emaSlow[i]! : null));

  // DEA 只对 DIF 有值的部分计算，再按原下标放回
  const start = dif.findIndex((v) => v !== null);
  const dea: (number | null)[] = new Array(closes.length).fill(null);
  if (start >= 0) {
    const deaPart = calcEMA(dif.slice(start) as number[], signal);
    deaPart.forEach((v, i) => { dea[start + i] = v; });
  }
  const hist = dif.map((v, i) => (v !== null && dea[i] !== null ? v - dea[i]! : null));
  return { dif, dea, hist };
};
