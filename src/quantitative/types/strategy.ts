/**
 * 量化交易 - 策略相关类型定义
 */

// 策略类型枚举
export type StrategyType = 'breakout' | 'trend_following' | 'grid' | 'custom';

// 策略模式枚举
export type StrategyMode = 'backtest' | 'paper' | 'live';

// 策略配置
export interface StrategyConfig {
  id?: number;
  name: string;
  type: StrategyType;
  description: string;
  parameters: Record<string, any>; // 策略参数（动态结构）
  enabled: boolean;
  mode: StrategyMode;
  created_at?: string;
  updated_at?: string;
}

// 策略性能统计
export interface StrategyPerformance {
  strategy_id: number;
  total_backtests: number;
  total_trades: number;
  win_trades: number;
  loss_trades: number;
  win_rate: number;
  avg_return: number;
  avg_sharpe: number;
  avg_max_drawdown: number;
}

// 突破策略参数
export interface BreakoutStrategyParams {
  lookback_period: number;
  min_range_touches: number;
  min_confidence: number;
  min_strength: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  position_size_percent: number;
}

// 趋势跟踪策略参数
export interface TrendFollowingParams {
  fast_ma_period: number;
  slow_ma_period: number;
  trend_ma_period: number;
  rsi_period: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  position_size_percent: number;
}

// 策略列表响应
export interface StrategiesResponse {
  success: boolean;
  data: StrategyConfig[];
  count: number;
}

// 策略切换请求
export interface ToggleStrategyRequest {
  enabled: boolean;
}
