/**
 * 量化交易 - 参数验证工具函数
 */

/**
 * 验证策略名称
 */
export const validateStrategyName = (name: string): string | null => {
  if (!name || name.trim().length === 0) {
    return '策略名称不能为空';
  }
  if (name.length > 100) {
    return '策略名称不能超过100个字符';
  }
  return null;
};

/**
 * 验证百分比参数
 */
export const validatePercent = (value: number, min: number = 0, max: number = 100): string | null => {
  if (isNaN(value)) {
    return '请输入有效的数字';
  }
  if (value < min) {
    return `值不能小于${min}%`;
  }
  if (value > max) {
    return `值不能大于${max}%`;
  }
  return null;
};

/**
 * 验证整数参数
 */
export const validateInteger = (value: number, min: number = 1, max?: number): string | null => {
  if (isNaN(value)) {
    return '请输入有效的数字';
  }
  if (!Number.isInteger(value)) {
    return '请输入整数';
  }
  if (value < min) {
    return `值不能小于${min}`;
  }
  if (max !== undefined && value > max) {
    return `值不能大于${max}`;
  }
  return null;
};

/**
 * 验证资金金额
 */
export const validateCapital = (value: number): string | null => {
  if (isNaN(value)) {
    return '请输入有效的金额';
  }
  if (value <= 0) {
    return '资金金额必须大于0';
  }
  if (value > 1000000000) {
    return '资金金额过大';
  }
  return null;
};

/**
 * 验证手续费率
 */
export const validateCommissionRate = (value: number): string | null => {
  if (isNaN(value)) {
    return '请输入有效的手续费率';
  }
  if (value < 0) {
    return '手续费率不能为负数';
  }
  if (value > 0.1) {
    return '手续费率不能超过10%';
  }
  return null;
};

/**
 * 验证时间范围
 */
export const validateTimeRange = (startTime: number, endTime: number): string | null => {
  if (isNaN(startTime) || isNaN(endTime)) {
    return '请选择有效的时间';
  }
  if (startTime >= endTime) {
    return '开始时间必须早于结束时间';
  }
  const now = Date.now();
  if (endTime > now) {
    return '结束时间不能晚于当前时间';
  }
  const minDuration = 24 * 60 * 60 * 1000; // 1天
  if (endTime - startTime < minDuration) {
    return '时间范围至少需要1天';
  }
  const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1年
  if (endTime - startTime > maxDuration) {
    return '时间范围不能超过1年';
  }
  return null;
};

/**
 * 验证币种符号
 */
export const validateSymbol = (symbol: string): string | null => {
  if (!symbol || symbol.trim().length === 0) {
    return '币种符号不能为空';
  }
  if (!/^[A-Z0-9]+$/.test(symbol)) {
    return '币种符号只能包含大写字母和数字';
  }
  return null;
};

/**
 * 验证黑名单列表
 */
export const validateBlacklist = (symbols: string[]): string | null => {
  if (!Array.isArray(symbols)) {
    return '黑名单必须是数组';
  }
  for (const symbol of symbols) {
    const error = validateSymbol(symbol);
    if (error) {
      return `黑名单包含无效币种: ${symbol}`;
    }
  }
  return null;
};

/**
 * 验证策略参数对象
 */
export const validateStrategyParams = (params: Record<string, any>, type: string): string | null => {
  if (type === 'breakout') {
    // 验证突破策略参数
    const requiredFields = [
      'lookback_period',
      'min_range_touches',
      'min_confidence',
      'min_strength',
      'stop_loss_percent',
      'take_profit_percent',
      'position_size_percent',
    ];
    for (const field of requiredFields) {
      if (params[field] === undefined) {
        return `缺少必需参数: ${field}`;
      }
    }
  } else if (type === 'trend_following') {
    // 验证趋势跟踪策略参数
    const requiredFields = [
      'fast_ma_period',
      'slow_ma_period',
      'trend_ma_period',
      'rsi_period',
      'stop_loss_percent',
      'take_profit_percent',
      'position_size_percent',
    ];
    for (const field of requiredFields) {
      if (params[field] === undefined) {
        return `缺少必需参数: ${field}`;
      }
    }
  }
  return null;
};
