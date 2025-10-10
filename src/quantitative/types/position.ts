/**
 * 量化交易 - 持仓相关类型定义
 */

import { TradeSide } from './trade';

// 持仓状态
export type PositionStatus = 'open' | 'closed';

// 持仓
export interface Position {
  id: number;
  strategy_id: number;
  symbol: string;
  side: TradeSide;
  entry_price: number;
  quantity: number;
  entry_time: string;
  stop_loss: number;
  take_profit: number;
  unrealized_pnl: number;
  status: PositionStatus;
  created_at: string;
  updated_at: string;
}

// 持仓统计
export interface PositionStatistics {
  total_positions: number;
  open_positions: number;
  closed_positions: number;
  total_value: number;
  total_unrealized_pnl: number;
  total_realized_pnl: number;
}

// 持仓列表查询参数
export interface PositionListParams {
  strategy_id?: number;
  status?: PositionStatus;
}

// 持仓统计查询参数
export interface PositionStatisticsParams {
  strategy_id?: number;
}
