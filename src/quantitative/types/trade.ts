/**
 * 量化交易 - 交易记录相关类型定义
 */

// 交易方向
export type TradeSide = 'LONG' | 'SHORT';

// 出场原因
export type ExitReason = 'take_profit' | 'stop_loss' | 'signal' | 'manual';

// 交易记录
export interface Trade {
  id: number;
  strategy_id?: number;
  backtest_id?: number;
  symbol: string;
  side: TradeSide;
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_time: string;
  exit_time: string;
  pnl: number;
  pnl_percent: number;
  commission: number;
  exit_reason: ExitReason;
  created_at: string;
}

// 交易统计
export interface TradeStatistics {
  total_trades: number;
  win_trades: number;
  loss_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
}

// 交易列表查询参数
export interface TradeListParams {
  strategy_id?: number;
  symbol?: string;
  limit?: number;
  offset?: number;
}

// 交易统计查询参数
export interface TradeStatisticsParams {
  strategy_id?: number;
  symbol?: string;
}
