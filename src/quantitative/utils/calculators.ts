/**
 * 量化交易 - 计算工具函数
 */

/**
 * 计算收益率
 */
export const calculateReturn = (initial: number, final: number): number => {
  return ((final - initial) / initial) * 100;
};

/**
 * 计算年化收益率
 */
export const calculateAnnualReturn = (totalReturn: number, days: number): number => {
  return (totalReturn / days) * 365;
};

/**
 * 计算夏普比率
 * @param returns 收益率数组
 * @param riskFreeRate 无风险利率（默认0）
 */
export const calculateSharpeRatio = (returns: number[], riskFreeRate: number = 0): number => {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  return (avgReturn - riskFreeRate) / stdDev;
};

/**
 * 计算最大回撤
 * @param equityCurve 资金曲线数组
 */
export const calculateMaxDrawdown = (equityCurve: number[]): number => {
  let maxDrawdown = 0;
  let peak = equityCurve[0];

  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = ((peak - value) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
};

/**
 * 计算盈亏比（Profit Factor）
 */
export const calculateProfitFactor = (totalProfit: number, totalLoss: number): number => {
  if (totalLoss === 0) return totalProfit > 0 ? Infinity : 0;
  return totalProfit / Math.abs(totalLoss);
};

/**
 * 计算胜率
 */
export const calculateWinRate = (winTrades: number, totalTrades: number): number => {
  if (totalTrades === 0) return 0;
  return (winTrades / totalTrades) * 100;
};

/**
 * 计算平均盈利/亏损
 */
export const calculateAverage = (trades: number[]): number => {
  if (trades.length === 0) return 0;
  return trades.reduce((sum, t) => sum + t, 0) / trades.length;
};

/**
 * 计算风险价值（VaR - Value at Risk）
 * @param returns 收益率数组
 * @param confidenceLevel 置信度（如0.95表示95%）
 */
export const calculateVaR = (returns: number[], confidenceLevel: number = 0.95): number => {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  return sorted[index];
};

/**
 * 计算仓位占比
 */
export const calculatePositionPercent = (positionValue: number, totalCapital: number): number => {
  if (totalCapital === 0) return 0;
  return (positionValue / totalCapital) * 100;
};

/**
 * 计算止损价
 */
export const calculateStopLoss = (entryPrice: number, stopLossPercent: number, side: 'LONG' | 'SHORT'): number => {
  if (side === 'LONG') {
    return entryPrice * (1 - stopLossPercent / 100);
  } else {
    return entryPrice * (1 + stopLossPercent / 100);
  }
};

/**
 * 计算止盈价
 */
export const calculateTakeProfit = (entryPrice: number, takeProfitPercent: number, side: 'LONG' | 'SHORT'): number => {
  if (side === 'LONG') {
    return entryPrice * (1 + takeProfitPercent / 100);
  } else {
    return entryPrice * (1 - takeProfitPercent / 100);
  }
};

/**
 * 计算未实现盈亏
 */
export const calculateUnrealizedPnL = (
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  side: 'LONG' | 'SHORT'
): number => {
  if (side === 'LONG') {
    return (currentPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - currentPrice) * quantity;
  }
};

/**
 * 计算风险收益比
 */
export const calculateRiskRewardRatio = (potentialProfit: number, potentialLoss: number): number => {
  if (potentialLoss === 0) return potentialProfit > 0 ? Infinity : 0;
  return potentialProfit / Math.abs(potentialLoss);
};
