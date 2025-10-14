/**
 * 量化交易 - 回测系统API
 */

import { czscApiGet, czscApiPost } from '../../services/czscApiClient';
import {
  BacktestRequest,
  BacktestResult,
  BacktestListParams,
  Trade,
  CZSCBacktestResult,
  CZSCBacktestListItem,
  CZSCBacktestDetail
} from '../types';

// ============ 数据转换函数 ============

/**
 * 将CZSC回测结果转换为前端格式
 */
const convertFromCZSCBacktestResult = (czscResult: CZSCBacktestResult, strategyId?: number): BacktestResult => {
  const stats = czscResult.stats;

  // 计算最终资金
  const initialCapital = 100000; // 默认值
  const totalReturn = stats.绝对收益 || stats.年化 || 0;
  const finalCapital = initialCapital * (1 + totalReturn);

  // 转换资金曲线（兼容新旧格式）
  const equityCurve = (czscResult.equity_curve || []).map(point => ({
    time: new Date(point.dt || point.date || '').getTime(),
    value: point.equity || point.total || initialCapital
  }));

  // 计算回撤曲线
  let maxEquity = initialCapital;
  const drawdownCurve = equityCurve.map(point => {
    if (point.value > maxEquity) maxEquity = point.value;
    const drawdown = maxEquity > 0 ? (maxEquity - point.value) / maxEquity : 0;
    return {
      time: point.time,
      drawdown: drawdown
    };
  });

  // 计算月度收益（简化版）
  const monthlyReturns: Record<string, number> = {};

  // 获取交易明细（兼容 trade_pairs 和 trades）
  const trades = czscResult.trade_pairs || czscResult.trades || [];

  return {
    id: 0,
    strategy_id: strategyId || 0,
    symbol: czscResult.symbol,
    interval: czscResult.freq,
    start_time: czscResult.start_date,
    end_time: czscResult.end_date,
    initial_capital: initialCapital,
    final_capital: finalCapital,
    total_return: totalReturn,
    annual_return: stats.年化 || 0,
    sharpe_ratio: stats.夏普 || 0,
    max_drawdown: stats.最大回撤 || 0,
    total_trades: czscResult.trades_count || trades.length,
    win_trades: Math.round((stats.交易胜率 || 0) * trades.length),
    loss_trades: Math.round((1 - (stats.交易胜率 || 0)) * trades.length),
    win_rate: stats.交易胜率 || 0,
    avg_win: stats.单笔收益 || 0,
    avg_loss: 0,
    profit_factor: 0,
    performance_data: {
      equity_curve: equityCurve,
      drawdown_curve: drawdownCurve,
      monthly_returns: monthlyReturns
    },
    created_at: czscResult.created_at || new Date().toISOString(),
    task_id: czscResult.task_id,
    trades: trades.map((trade, index) => ({
      id: index,
      backtest_id: 0,
      symbol: czscResult.symbol,
      entry_time: trade.开仓时间,
      exit_time: trade.平仓时间,
      entry_price: trade.开仓价格,
      exit_price: trade.平仓价格,
      quantity: 1,
      profit: (trade.盈亏比例 / 10000) * trade.开仓价格, // BP转金额
      profit_rate: trade.盈亏比例 / 10000, // BP转比例
      direction: trade.交易方向 === '多头' ? 'long' : 'short'
    }))
  };
};

// ============ API接口 ============

export const backtestAPI = {
  /**
   * 运行回测（CZSC Position策略回测）
   * POST /api/v1/backtest/czsc
   * @param request 回测请求参数
   * @returns 回测结果
   */
  runBacktest: async (request: BacktestRequest): Promise<BacktestResult> => {
    // 时间戳转ISO 8601字符串
    const startDate = new Date(request.start_time).toISOString();
    const endDate = new Date(request.end_time).toISOString();

    // 使用策略ID方式（推荐）
    // API会从策略库中加载完整的Position和Signal配置
    const czscRequest = {
      symbol: request.symbol,
      freq: request.interval,
      start_date: startDate,
      end_date: endDate,
      strategy_id: request.strategy_id  // 传策略ID，后端自动加载策略配置
    };

    const czscResult = await czscApiPost<CZSCBacktestResult>('/api/v1/backtest/czsc', czscRequest);
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
