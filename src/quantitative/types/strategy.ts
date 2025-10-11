/**
 * 量化交易 - 策略相关类型定义
 *
 * ⚠️ 注意：已迁移到CZSC回测系统
 * 本文件保留旧版类型定义以保持向后兼容
 * 新增CZSC相关类型定义
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

// ==================== CZSC策略类型定义 ====================

/**
 * CZSC策略信号配置
 */
export interface CZSCStrategySignal {
  name: string;          // 信号函数名
  freq: string;          // 周期
}

/**
 * CZSC策略条件类型
 */
export type CZSCConditionType = 'signal_match' | 'stop_loss' | 'take_profit' | 'holding_bars';

/**
 * CZSC策略条件
 */
export interface CZSCStrategyCondition {
  type: CZSCConditionType;
  signal_pattern?: string;    // 信号模式（signal_match类型）
  value?: number;             // 数值（其他类型）
  description?: string;       // 条件描述
}

/**
 * CZSC策略规则
 */
export interface CZSCStrategyRules {
  operator: 'AND' | 'OR';
  conditions: CZSCStrategyCondition[];
}

/**
 * CZSC仓位管理
 */
export interface CZSCPositionSizing {
  type: 'fixed' | 'percentage' | 'kelly';
  value: number;
  description?: string;
}

/**
 * CZSC风控设置
 */
export interface CZSCRiskManagement {
  max_position?: number;
  max_loss_per_trade?: number;
  max_daily_loss?: number;
}

/**
 * CZSC策略完整配置
 */
export interface CZSCStrategy {
  strategy_id: string;
  name: string;
  description?: string;
  author?: string;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  signals: CZSCStrategySignal[];
  entry_rules: CZSCStrategyRules;
  exit_rules: CZSCStrategyRules;
  position_sizing?: CZSCPositionSizing;
  risk_management?: CZSCRiskManagement;
}

/**
 * CZSC策略列表项
 */
export interface CZSCStrategyListItem {
  strategy_id: string;
  name: string;
  description?: string;
  author?: string;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * CZSC策略列表响应
 */
export interface CZSCStrategyListResponse {
  total: number;
  strategies: CZSCStrategyListItem[];
  limit: number;
  offset: number;
}

/**
 * CZSC策略回测历史项
 */
export interface CZSCBacktestHistoryItem {
  backtest_task_id: string;
  backtest_time: string;
  total_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  trades_count: number;
}

/**
 * CZSC策略回测历史响应
 */
export interface CZSCStrategyBacktestHistory {
  strategy_id: string;
  total: number;
  backtests: CZSCBacktestHistoryItem[];
}
