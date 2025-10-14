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
  task_id?: string;           // CZSC系统的任务ID
  trades?: Trade[];           // 交易明细（CZSC直接返回）
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

// 交易记录
export interface Trade {
  id: number;
  backtest_id: number;
  symbol: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  profit: number;
  profit_rate: number;
  direction: 'long' | 'short';
}

// ============ CZSC 回测系统类型 ============

// CZSC 信号配置
export interface CZSCSignalConfig {
  signal_names: string[];      // 信号函数名称列表
  fee_rate?: number;            // 手续费率，默认 0.0002 (0.02%)
  initial_cash?: number;        // 初始资金，默认 100000
}

// CZSC 回测请求参数
export interface CZSCBacktestRequest {
  symbol: string;               // 标的代码
  freq: string;                 // 周期 (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
  start_date: string;           // 开始时间 (ISO 8601格式)
  end_date: string;             // 结束时间 (ISO 8601格式)
  signal_config: CZSCSignalConfig;
}

// CZSC 回测统计数据（后端返回中文字段）
export interface CZSCBacktestStats {
  开始日期?: string;
  结束日期?: string;
  绝对收益?: number;
  年化?: number;              // 年化收益率
  夏普?: number;              // 夏普比率
  最大回撤?: number;          // 最大回撤
  卡玛?: number;              // 卡玛比率
  索提诺?: number;            // 索提诺比率
  盈亏平衡点?: number;        // 盈亏平衡点
  日胜率?: number;
  非零覆盖?: number;
  交易胜率?: number;          // 交易胜率
  单笔收益?: number;          // 单笔平均收益（BP）
  日收益?: number;
  日收益std?: number;
  [key: string]: any;         // 支持其他动态字段
}

// CZSC 交易记录（后端返回中文字段）
export interface CZSCTrade {
  开仓时间: string;
  平仓时间: string;
  交易方向: string;            // "多头" | "空头"
  开仓价格: number;
  平仓价格: number;
  盈亏比例: number;            // BP单位
  持仓K线数: number;
}

// CZSC 资金曲线点
export interface CZSCEquityPoint {
  dt?: string;                  // 时间（旧格式）
  date?: string;                // 时间（新格式）
  equity?: number;              // 权益（旧格式）
  total?: number;               // 权益（新格式）
  price?: number;               // 价格
}

// CZSC 回测结果
export interface CZSCBacktestResult {
  task_id: string;
  symbol: string;
  freq: string;
  start_date: string;
  end_date: string;
  status?: 'completed' | 'failed';
  stats: CZSCBacktestStats;
  trade_pairs?: CZSCTrade[];      // 注意：字段名是 trade_pairs
  trades?: CZSCTrade[];           // 兼容旧字段名
  trades_count?: number;
  equity_curve?: CZSCEquityPoint[];
  created_at?: string;
}

// CZSC 回测列表项（新版API - 包含完整统计数据）
export interface CZSCBacktestListItem {
  id: number;
  task_id: string;
  symbol: string;
  freq: string;
  start_date: string;
  end_date: string;
  total_return: number;
  annual_return: number;
  cumulative_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  calmar_ratio: number;
  sortino_ratio: number;
  volatility: number;
  total_trades: number;
  win_trades: number;          // 注意：后端字段名
  loss_trades: number;         // 注意：后端字段名
  win_rate: number;
  avg_profit: number;
  avg_loss: number;
  profit_factor: number;
  avg_holding_bars: number;
  max_holding_bars: number;
  break_even_point: number;
  single_trade_return: number;
  stats_data?: any;           // 完整统计数据JSON
  created_at: string;
}

// CZSC 回测列表响应（新版API格式）
export interface CZSCBacktestListResponse {
  code: number;
  message: string;
  data: {
    total: number;
    results: CZSCBacktestListItem[];
  };
}

// CZSC 回测详情响应（GET /api/v1/backtest/{task_id}）
export interface CZSCBacktestDetail {
  id: number;
  task_id: string;
  symbol: string;
  freq: string;
  start_date: string;
  end_date: string;
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  total_trades: number;
  win_rate: number;
  stats_data: CZSCBacktestStats;    // 完整统计数据
  equity_curve: CZSCEquityPoint[];   // 权益曲线
  trades_data: CZSCTrade[];          // ⚠️ 注意：字段名是 trades_data，不是 trades
  created_at: string;
}
