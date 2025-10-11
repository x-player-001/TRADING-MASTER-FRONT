/**
 * 量化交易 - 回测系统API
 */

import { czscApiGet, czscApiPost } from '../../services/czscApiClient';
import {
  BacktestRequest,
  BacktestResult,
  BacktestListParams,
  Trade,
  CZSCBacktestRequest,
  CZSCBacktestResult,
  CZSCBacktestListResponse,
  CZSCBacktestListItem,
  CZSCBacktestDetail
} from '../types';

// ============ 数据转换函数 ============

/**
 * 将前端回测请求转换为CZSC格式
 */
const convertToCSCBacktestRequest = (request: BacktestRequest, signalNames: string[]): CZSCBacktestRequest => {
  // 时间戳转ISO 8601字符串
  const startDate = new Date(request.start_time).toISOString();
  const endDate = new Date(request.end_time).toISOString();

  return {
    symbol: request.symbol,
    freq: request.interval,
    start_date: startDate,
    end_date: endDate,
    signal_config: {
      signal_names: signalNames,
      fee_rate: request.commission_rate || 0.0002,
      initial_cash: request.initial_capital || 100000
    }
  };
};

/**
 * 将CZSC回测结果转换为前端格式
 */
const convertFromCZSCBacktestResult = (czscResult: CZSCBacktestResult, strategyId?: number): BacktestResult => {
  const stats = czscResult.stats;

  // 计算最终资金
  const initialCapital = 100000; // 默认值
  const finalCapital = initialCapital * (1 + stats.cumulative_return);

  // 转换资金曲线
  const equityCurve = czscResult.equity_curve.map(point => ({
    time: new Date(point.dt).getTime(),
    value: point.equity
  }));

  // 计算回撤曲线（简化版）
  let maxEquity = initialCapital;
  const drawdownCurve = czscResult.equity_curve.map(point => {
    if (point.equity > maxEquity) maxEquity = point.equity;
    const drawdown = (maxEquity - point.equity) / maxEquity;
    return {
      time: new Date(point.dt).getTime(),
      drawdown: drawdown
    };
  });

  // 计算月度收益（简化版）
  const monthlyReturns: Record<string, number> = {};

  return {
    id: 0, // CZSC没有数字ID，使用0占位
    strategy_id: strategyId || 0,
    symbol: czscResult.symbol,
    interval: czscResult.freq,
    start_time: czscResult.start_date,
    end_time: czscResult.end_date,
    initial_capital: initialCapital,
    final_capital: finalCapital,
    total_return: stats.total_return,
    annual_return: stats.annual_return,
    sharpe_ratio: stats.sharpe_ratio,
    max_drawdown: stats.max_drawdown,
    total_trades: stats.total_trades,
    win_trades: stats.winning_trades,
    loss_trades: stats.losing_trades,
    win_rate: stats.win_rate,
    avg_win: stats.avg_profit,
    avg_loss: Math.abs(stats.avg_loss), // 转为正数
    profit_factor: stats.profit_loss_ratio,
    performance_data: {
      equity_curve: equityCurve,
      drawdown_curve: drawdownCurve,
      monthly_returns: monthlyReturns
    },
    created_at: czscResult.created_at || new Date().toISOString(),
    task_id: czscResult.task_id,
    trades: czscResult.trades.map((trade, index) => ({
      id: index,
      backtest_id: 0,
      entry_time: trade.entry_time,
      exit_time: trade.exit_time,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      quantity: 1,
      profit: trade.profit,
      profit_rate: trade.profit_rate,
      direction: 'long' as const
    }))
  };
};

// ============ API接口 ============

export const backtestAPI = {
  /**
   * 运行回测（CZSC信号回测）
   * POST /api/v1/backtest/signal
   * @param request 回测请求参数
   * @param signalNames 信号函数名称列表
   * @returns 回测结果
   */
  runBacktest: async (request: BacktestRequest, signalNames?: string[]): Promise<BacktestResult> => {
    // 如果没有提供信号名称，使用默认的三买三卖信号
    const defaultSignals = ['cxt_third_bs_V230318'];
    const signals = signalNames && signalNames.length > 0 ? signalNames : defaultSignals;

    const czscRequest = convertToCSCBacktestRequest(request, signals);
    const czscResult = await czscApiPost<CZSCBacktestResult>('/api/v1/backtest/signal', czscRequest);
    return convertFromCZSCBacktestResult(czscResult, request.strategy_id);
  },

  /**
   * 获取回测结果列表
   * GET /api/v1/backtest/list
   */
  getBacktestResults: async (params?: BacktestListParams): Promise<BacktestResult[]> => {
    // czscApiClient已自动解包data字段，这里直接得到 {total, results}
    const listData = await czscApiGet<{ total: number; results: CZSCBacktestListItem[] }>('/api/v1/backtest/list', {
      params: {
        symbol: params?.symbol,
        limit: params?.limit
      }
    });

    const results = listData.results || [];

    // 转换列表项为前端格式（新版API已包含完整统计数据）
    return results.map(item => ({
      id: item.id || 0,
      strategy_id: 0,
      symbol: item.symbol,
      interval: item.freq,
      start_time: item.start_date,
      end_time: item.end_date,
      initial_capital: 100000,
      final_capital: 100000 * (1 + item.total_return),
      total_return: item.total_return,
      annual_return: item.annual_return,
      sharpe_ratio: item.sharpe_ratio,
      max_drawdown: item.max_drawdown,
      total_trades: item.total_trades,
      win_trades: item.win_trades,
      loss_trades: item.loss_trades,
      win_rate: item.win_rate,
      avg_win: item.avg_profit,
      avg_loss: Math.abs(item.avg_loss), // 转为正数
      profit_factor: item.profit_factor,
      performance_data: {
        equity_curve: [],
        drawdown_curve: [],
        monthly_returns: {}
      },
      created_at: item.created_at,
      task_id: item.task_id
    }));
  },

  /**
   * 获取回测详情
   * GET /api/v1/backtest/:task_id
   */
  getBacktestDetail: async (taskId: string): Promise<BacktestResult> => {
    // czscApiClient已自动解包data字段
    const detail = await czscApiGet<CZSCBacktestDetail>(`/api/v1/backtest/${taskId}`);

    // 转换为前端格式
    const stats = detail.stats_data;
    const initialCapital = 100000;

    // 转换资金曲线
    const equityCurve = detail.equity_curve.map(point => ({
      time: new Date(point.dt).getTime(),
      value: point.equity
    }));

    // 计算回撤曲线
    let maxEquity = initialCapital;
    const drawdownCurve = detail.equity_curve.map(point => {
      if (point.equity > maxEquity) maxEquity = point.equity;
      const drawdown = (maxEquity - point.equity) / maxEquity;
      return {
        time: new Date(point.dt).getTime(),
        drawdown: drawdown
      };
    });

    return {
      id: detail.id || 0,
      strategy_id: 0,
      symbol: detail.symbol,
      interval: detail.freq,
      start_time: detail.start_date,
      end_time: detail.end_date,
      initial_capital: initialCapital,
      final_capital: initialCapital * (1 + stats.total_return),
      total_return: stats.total_return,
      annual_return: stats.annual_return,
      sharpe_ratio: stats.sharpe_ratio,
      max_drawdown: stats.max_drawdown,
      total_trades: stats.total_trades,
      win_trades: stats.winning_trades,
      loss_trades: stats.losing_trades,
      win_rate: stats.win_rate,
      avg_win: stats.avg_profit,
      avg_loss: Math.abs(stats.avg_loss),
      profit_factor: stats.profit_loss_ratio,
      performance_data: {
        equity_curve: equityCurve,
        drawdown_curve: drawdownCurve,
        monthly_returns: {}
      },
      created_at: detail.created_at,
      task_id: detail.task_id,
      // ⚠️ 注意：详情接口使用 trades_data 字段名
      trades: detail.trades_data.map((trade, index) => ({
        id: index,
        backtest_id: detail.id || 0,
        entry_time: trade.entry_time,
        exit_time: trade.exit_time,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        quantity: 1,
        profit: trade.profit,
        profit_rate: trade.profit_rate,
        direction: 'long' as const
      }))
    };
  },

  /**
   * 获取回测交易明细
   * 从回测详情中提取trades_data
   */
  getBacktestTrades: async (taskId: string): Promise<Trade[]> => {
    const detail = await czscApiGet<CZSCBacktestDetail>(`/api/v1/backtest/${taskId}`);

    // ⚠️ 注意：详情接口使用 trades_data 字段名
    return detail.trades_data.map((trade, index) => ({
      id: index,
      backtest_id: detail.id || 0,
      entry_time: trade.entry_time,
      exit_time: trade.exit_time,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      quantity: 1, // CZSC不提供数量，使用1
      profit: trade.profit,
      profit_rate: trade.profit_rate,
      direction: 'long' as const // CZSC默认只做多
    }));
  },
};
