/**
 * 量化交易 - 回测相关类型定义
 */

// 回测请求参数
export interface BacktestRequest {
  strategy_id: number;
  symbol: string;
  interval: string;
  start_time: number;
  end_time: number;
  initial_capital: number;
  commission_rate?: number;
}

// 资金曲线点
export interface EquityPoint {
  time: number;
  value: number;
}

// 回撤曲线点
export interface DrawdownPoint {
  time: number;
  drawdown: number;
}

// 性能数据
export interface PerformanceData {
  equity_curve: EquityPoint[];
  drawdown_curve: DrawdownPoint[];
  monthly_returns: Record<string, number>;
}

// 回测结果
export interface BacktestResult {
  id: number;
  strategy_id: number;
  symbol: string;
  interval: string;
  start_time: string;
  end_time: string;
  initial_capital: number;
  final_capital: number;
  total_return: number;
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  total_trades: number;
  win_trades: number;
  loss_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  performance_data: PerformanceData;
  created_at: string;
}

// 回测结果列表查询参数
export interface BacktestListParams {
  limit?: number;
  offset?: number;
  strategy_id?: number;
  symbol?: string;
}

// 最佳回测查询指标
export type BestMetric = 'sharpe_ratio' | 'total_return' | 'win_rate' | 'profit_factor';

// 异步任务状态
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任务进度信息
export interface TaskProgress {
  current_kline: number;
  total_klines: number;
  trades_count: number;
  elapsed_seconds: number;
}

// 回测任务创建响应
export interface BacktestTaskResponse {
  task_id: string;
  status: TaskStatus;
  message: string;
}

// 回测任务状态
export interface BacktestTask {
  task_id: string;
  status: TaskStatus;
  progress?: TaskProgress;
  result?: BacktestResult;
  error?: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
}

// 任务列表查询参数
export interface TaskListParams {
  limit?: number;
  status?: TaskStatus;
}
