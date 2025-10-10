/**
 * 量化交易 - 风险管理相关类型定义
 */

import { TradeSide } from './trade';

// 风控配置
export interface RiskConfig {
  strategy_id: number;
  max_positions: number;
  max_position_size_percent: number;
  max_total_risk_percent: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  max_daily_loss_percent: number;
  blacklist_symbols: string[];
}

// 持仓风险详情
export interface PositionRiskDetail {
  symbol: string;
  side: TradeSide;
  position_value: number;
  risk_amount: number;
  unrealized_pnl: number;
}

// 风险敞口
export interface RiskExposure {
  total_positions: number;
  total_risk_amount: number;
  total_risk_percent: number;
  available_capital: number;
  daily_pnl: number;
  daily_pnl_percent: number;
  positions: PositionRiskDetail[];
}

// 风险检查结果
export interface RiskCheckResult {
  can_open: boolean;
  reason: string;
  current_positions_count: number;
  current_risk_percent: number;
  daily_pnl_percent: number;
}

// 风险敞口查询参数
export interface RiskExposureParams {
  strategy_id: number;
  total_capital: number;
}

// 风险检查查询参数
export interface RiskCheckParams {
  strategy_id: number;
  symbol: string;
  position_value: number;
  total_capital: number;
}
