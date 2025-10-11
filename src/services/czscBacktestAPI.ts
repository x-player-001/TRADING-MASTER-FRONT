/**
 * CZSC回测系统 - 回测接口
 * Base URL: http://localhost:8000
 */

import { czscApiGet, czscApiPost } from './czscApiClient';

// ============= 类型定义 =============

/**
 * 回测信号配置
 */
export interface BacktestSignalConfig {
  signal_names: string[];          // 信号函数名称列表
  fee_rate?: number;               // 手续费率，默认0.0002
  initial_cash?: number;           // 初始资金，默认100000
}

/**
 * 信号回测请求
 */
export interface SignalBacktestRequest {
  symbol: string;                  // 标的代码
  freq: string;                    // 周期 (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
  start_date: string;              // 回测开始时间 (ISO 8601格式)
  end_date: string;                // 回测结束时间
  signal_config: BacktestSignalConfig;
}

/**
 * 回测统计数据
 */
export interface BacktestStats {
  总收益: number;
  年化: number;
  累计收益: number;
  最大回撤: number;
  夏普: number;
  卡玛: number;
  索提诺: number;
  波动率: number;
  交易次数: number;
  盈利次数: number;
  亏损次数: number;
  交易胜率: number;
  平均盈利: number;
  平均亏损: number;
  盈亏比: number;
  平均持仓K线数: number;
  最大持仓K线数: number;
  盈亏平衡点: number;
  单笔收益: number;
}

/**
 * 回测交易记录
 */
export interface BacktestTrade {
  entry_time: string;              // 入场时间
  exit_time: string;               // 出场时间
  entry_price: number;             // 入场价格
  exit_price: number;              // 出场价格
  profit: number;                  // 盈亏金额
  profit_rate: number;             // 盈亏比例
  entry_signal: string;            // 入场信号
  exit_signal: string;             // 出场信号
}

/**
 * 权益曲线点
 */
export interface EquityPoint {
  dt: string;                      // 时间
  equity: number;                  // 权益
  price: number;                   // 价格
}

/**
 * 回测结果响应
 */
export interface BacktestResult {
  task_id: string;
  symbol: string;
  freq: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stats: BacktestStats;
  trades: BacktestTrade[];
  trades_count: number;
  equity_curve: EquityPoint[];
}

/**
 * 回测列表项
 */
export interface BacktestListItem {
  task_id: string;
  symbol: string;
  freq: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  total_return: number;
  trades_count: number;
}

/**
 * 回测列表响应
 */
export interface BacktestListResponse {
  total: number;
  results: BacktestListItem[];
}

// ============= API服务类 =============

class CZSCBacktestAPI {
  /**
   * 基于信号的回测
   * POST /api/v1/backtest/signal
   */
  async runSignalBacktest(request: SignalBacktestRequest): Promise<BacktestResult> {
    return czscApiPost<BacktestResult>('/api/v1/backtest/signal', request);
  }

  /**
   * 查询回测结果列表
   * GET /api/v1/backtest/list
   */
  async getBacktestList(params?: {
    symbol?: string;
    freq?: string;
    limit?: number;
  }): Promise<BacktestListResponse> {
    return czscApiGet<BacktestListResponse>('/api/v1/backtest/list', { params });
  }

  /**
   * 查询单个回测详情
   * GET /api/v1/backtest/{task_id}
   */
  async getBacktestDetail(taskId: string): Promise<BacktestResult> {
    return czscApiGet<BacktestResult>(`/api/v1/backtest/${taskId}`);
  }
}

// 导出单例
export const czscBacktestAPI = new CZSCBacktestAPI();
export default czscBacktestAPI;
