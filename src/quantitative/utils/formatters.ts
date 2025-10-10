/**
 * 量化交易 - 格式化工具函数
 */

/**
 * 格式化金额（带货币符号）
 */
export const formatCurrency = (value: number, decimals: number = 2): string => {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * 格式化百分比
 */
export const formatPercent = (value: number, decimals: number = 2): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};

/**
 * 格式化数字（带千分位）
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * 格式化日期时间
 */
export const formatDateTime = (timestamp: string | number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * 格式化日期（仅日期）
 */
export const formatDate = (timestamp: string | number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * 格式化时间（仅时间）
 */
export const formatTime = (timestamp: string | number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * 格式化持续时间（秒 -> 天时分秒）
 */
export const formatDuration = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

  return parts.join(' ');
};

/**
 * 格式化策略类型
 */
export const formatStrategyType = (type: string): string => {
  const typeMap: Record<string, string> = {
    breakout: '突破策略',
    trend_following: '趋势跟踪',
    grid: '网格策略',
    custom: '自定义策略',
  };
  return typeMap[type] || type;
};

/**
 * 格式化策略模式
 */
export const formatStrategyMode = (mode: string): string => {
  const modeMap: Record<string, string> = {
    backtest: '回测模式',
    paper: '模拟交易',
    live: '实盘交易',
  };
  return modeMap[mode] || mode;
};

/**
 * 格式化交易方向
 */
export const formatTradeSide = (side: string): string => {
  return side === 'LONG' ? '做多' : '做空';
};

/**
 * 格式化出场原因
 */
export const formatExitReason = (reason: string): string => {
  const reasonMap: Record<string, string> = {
    take_profit: '止盈',
    stop_loss: '止损',
    signal: '信号平仓',
    manual: '手动平仓',
  };
  return reasonMap[reason] || reason;
};

/**
 * 格式化持仓状态
 */
export const formatPositionStatus = (status: string): string => {
  return status === 'open' ? '持仓中' : '已平仓';
};
