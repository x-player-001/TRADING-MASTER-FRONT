/**
 * 量化交易 - 常量定义
 */

// 策略类型选项
export const STRATEGY_TYPES = [
  { value: 'breakout', label: '突破策略' },
  { value: 'trend_following', label: '趋势跟踪' },
  { value: 'grid', label: '网格策略' },
  { value: 'custom', label: '自定义策略' },
];

// 策略模式选项
export const STRATEGY_MODES = [
  { value: 'backtest', label: '回测模式' },
  { value: 'paper', label: '模拟交易' },
  { value: 'live', label: '实盘交易' },
];

// 时间周期选项
export const INTERVALS = [
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '30m', label: '30分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
];

// 常见币种
export const SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'MATICUSDT',
  'DOTUSDT',
  'AVAXUSDT',
];

// 性能指标类型
export const METRIC_TYPES = [
  { value: 'sharpe_ratio', label: '夏普比率' },
  { value: 'total_return', label: '总收益率' },
  { value: 'win_rate', label: '胜率' },
  { value: 'profit_factor', label: '盈亏比' },
];

// 交易方向选项
export const TRADE_SIDES = [
  { value: 'LONG', label: '做多', color: '#10b981' },
  { value: 'SHORT', label: '做空', color: '#ef4444' },
];

// 出场原因选项
export const EXIT_REASONS = [
  { value: 'take_profit', label: '止盈', color: '#10b981' },
  { value: 'stop_loss', label: '止损', color: '#ef4444' },
  { value: 'signal', label: '信号平仓', color: '#3b82f6' },
  { value: 'manual', label: '手动平仓', color: '#6b7280' },
];

// 持仓状态选项
export const POSITION_STATUS = [
  { value: 'open', label: '持仓中', color: '#10b981' },
  { value: 'closed', label: '已平仓', color: '#6b7280' },
];

// 策略默认参数 - 突破策略
export const DEFAULT_BREAKOUT_PARAMS = {
  lookback_period: 200,
  min_range_touches: 4,
  min_confidence: 0.7,
  min_strength: 0.6,
  stop_loss_percent: 2.0,
  take_profit_percent: 5.0,
  position_size_percent: 10.0,
};

// 策略默认参数 - 趋势跟踪
export const DEFAULT_TREND_PARAMS = {
  fast_ma_period: 10,
  slow_ma_period: 30,
  trend_ma_period: 50,
  rsi_period: 14,
  stop_loss_percent: 3.0,
  take_profit_percent: 8.0,
  position_size_percent: 15.0,
};

// 回测默认配置
export const DEFAULT_BACKTEST_CONFIG = {
  initial_capital: 10000,
  commission_rate: 0.001, // 0.1%
};

// 风控默认配置
export const DEFAULT_RISK_CONFIG = {
  max_positions: 5,
  max_position_size_percent: 20.0,
  max_total_risk_percent: 50.0,
  stop_loss_percent: 2.0,
  take_profit_percent: 5.0,
  max_daily_loss_percent: 10.0,
  blacklist_symbols: [],
};

// 性能评估标准
export const PERFORMANCE_STANDARDS = {
  excellent: {
    sharpe_ratio: 2.0,
    max_drawdown: 10.0,
    win_rate: 60.0,
    profit_factor: 2.0,
  },
  good: {
    sharpe_ratio: 1.5,
    max_drawdown: 15.0,
    win_rate: 50.0,
    profit_factor: 1.5,
  },
  poor: {
    sharpe_ratio: 1.0,
    max_drawdown: 20.0,
    win_rate: 40.0,
    profit_factor: 1.0,
  },
};

// 表格分页配置
export const PAGINATION_CONFIG = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
};

// 图表颜色
export const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
  gray: '#6b7280',
};
