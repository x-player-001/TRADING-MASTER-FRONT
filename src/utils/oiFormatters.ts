/**
 * OI监控相关的格式化工具函数
 * 提供数字、时间、百分比等格式化功能
 */

/**
 * 格式化大数字为可读格式 (K, M, B)
 * @param num 要格式化的数字
 * @returns 格式化后的字符串
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

/**
 * 格式化运行时间
 * @param ms 毫秒数
 * @returns 格式化的时间字符串
 */
export const formatUptime = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

/**
 * 格式化百分比变化
 * @param value 百分比值
 * @param includeSign 是否包含正负号
 * @returns 格式化的百分比字符串
 */
export const formatPercentage = (value: number, includeSign = true): string => {
  const formatted = value.toFixed(2);
  if (includeSign && value >= 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
};

/**
 * 格式化时间戳为本地时间字符串
 * @param timestamp 时间戳
 * @returns 格式化的时间字符串
 */
export const formatTimestamp = (timestamp: string | number | Date): string => {
  return new Date(timestamp).toLocaleString();
};

/**
 * 格式化OI变化描述
 * @param change 变化值
 * @param before 变化前的值
 * @param after 变化后的值
 * @returns 格式化的描述对象
 */
export const formatOIChange = (change: number, before: string, after: string) => {
  return {
    direction: change > 0 ? '增长' : '下降',
    percentage: Math.abs(change).toFixed(2),
    beforeFormatted: `$${formatLargeNumber(parseFloat(before))}`,
    afterFormatted: `$${formatLargeNumber(parseFloat(after))}`,
    changeFormatted: `$${formatLargeNumber(parseFloat(String(Math.abs(change))))}`
  };
};