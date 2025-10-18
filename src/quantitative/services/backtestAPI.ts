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
 * ⚠️ 后端返回的百分比数据需要乘以100（如0.15 → 15%）
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
      drawdown: drawdown * 100  // 乘100转百分比
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
    total_return: (totalReturn || 0) * 100,           // 乘100转百分比
    annual_return: (stats.年化 || 0) * 100,           // 乘100转百分比
    sharpe_ratio: stats.夏普 || 0,                    // 夏普比率不需要乘100
    max_drawdown: (stats.最大回撤 || 0) * 100,        // 乘100转百分比
    total_trades: czscResult.trades_count || trades.length,
    win_trades: Math.round((stats.交易胜率 || 0) * trades.length),
    loss_trades: Math.round((1 - (stats.交易胜率 || 0)) * trades.length),
    win_rate: (stats.交易胜率 || 0) * 100,            // 乘100转百分比
    avg_win: (stats.单笔收益 || 0) * 100,             // 乘100转百分比 (如果是比例)
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
      profit_rate: (trade.盈亏比例 / 100),              // BP转百分比 (10000 BP = 100%)
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
    // ⚠️ 后端返回的百分比数据需要乘以100（如0.15 → 15%）
    return results.map(item => ({
      id: item.id || 0,
      strategy_id: 0,
      symbol: item.symbol,
      interval: item.freq,
      start_time: item.start_date,
      end_time: item.end_date,
      initial_capital: 100000,
      final_capital: 100000 * (1 + item.total_return),
      total_return: item.total_return * 100,          // 乘100转百分比
      annual_return: item.annual_return * 100,        // 乘100转百分比
      sharpe_ratio: item.sharpe_ratio,                // 夏普比率不需要乘100
      max_drawdown: item.max_drawdown * 100,          // 乘100转百分比
      total_trades: item.total_trades,
      win_trades: item.win_trades,
      loss_trades: item.loss_trades,
      win_rate: item.win_rate * 100,                  // 乘100转百分比
      avg_win: item.avg_profit * 100,                 // 乘100转百分比
      avg_loss: Math.abs(item.avg_loss) * 100,        // 乘100转百分比
      profit_factor: item.profit_factor,              // 盈亏比不需要乘100
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
   *
   * ⚠️ 重要：CZSCBacktestDetail包含两套数据：
   * 1. 顶层英文字段（total_return, annual_return等）- 直接使用
   * 2. stats_data中文字段（年化、夏普等）- 用于详细分析
   */
  getBacktestDetail: async (taskId: string): Promise<BacktestResult> => {
    // czscApiClient已自动解包data字段
    const detail = await czscApiGet<CZSCBacktestDetail>(`/api/v1/backtest/${taskId}`);

    // 从stats_data获取资金信息（如果存在）
    const initialCapital = detail.stats_data?.['初始资金'] || 100000;
    const finalCapital = detail.stats_data?.['最终资金'] || (initialCapital * (1 + detail.total_return));

    // 转换资金曲线（兼容 dt 和 date 字段）
    const equityCurve = detail.equity_curve.map(point => ({
      time: new Date(point.dt || point.date || '').getTime(),
      value: point.equity || point.total || initialCapital
    }));

    // 计算回撤曲线
    let maxEquity = initialCapital;
    const drawdownCurve = detail.equity_curve.map(point => {
      const equity = point.equity || point.total || initialCapital;
      if (equity > maxEquity) maxEquity = equity;
      const drawdown = maxEquity > 0 ? (maxEquity - equity) / maxEquity : 0;
      return {
        time: new Date(point.dt || point.date || '').getTime(),
        drawdown: drawdown * 100  // 乘100转百分比
      };
    });

    // ⚠️ 后端返回的百分比数据需要乘以100（如0.15 → 15%）
    // ⚠️ 使用顶层英文字段，不使用stats_data中的中文字段
    return {
      id: detail.id || 0,
      strategy_id: 0,
      symbol: detail.symbol,
      interval: detail.freq,
      start_time: detail.start_date,
      end_time: detail.end_date,
      initial_capital: initialCapital,
      final_capital: finalCapital,
      total_return: detail.total_return * 100,           // 使用顶层字段并乘100
      annual_return: detail.annual_return * 100,         // 使用顶层字段并乘100
      sharpe_ratio: detail.sharpe_ratio,                 // 夏普比率不需要乘100
      max_drawdown: detail.max_drawdown * 100,           // 使用顶层字段并乘100
      total_trades: detail.total_trades || 0,
      win_trades: Math.round((detail.win_rate || 0) * detail.total_trades),
      loss_trades: Math.round((1 - (detail.win_rate || 0)) * detail.total_trades),
      win_rate: detail.win_rate * 100,                   // 使用顶层字段并乘100
      avg_win: (detail.stats_data?.['单笔收益'] || 0),    // 单笔收益（可能是BP，需要确认）
      avg_loss: 0,                                       // CZSC不提供
      profit_factor: detail.stats_data?.['盈亏比'] || 0, // 从stats_data获取
      performance_data: {
        equity_curve: equityCurve,
        drawdown_curve: drawdownCurve,
        monthly_returns: {}
      },
      created_at: detail.created_at,
      task_id: detail.task_id,
      // ⚠️ 交易明细：trades_data包含英文字段名
      trades: detail.trades_data.map((trade, index) => ({
        id: index,
        backtest_id: detail.id || 0,
        entry_time: trade.entry_time,
        exit_time: trade.exit_time,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        quantity: 1,
        profit: trade.profit,
        profit_rate: trade.profit_rate * 100,           // 小数转百分比（0.011 → 1.1%）
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
    // ⚠️ profit_rate 需要乘以100转换为百分比
    return detail.trades_data.map((trade, index) => ({
      id: index,
      backtest_id: detail.id || 0,
      entry_time: trade.entry_time,
      exit_time: trade.exit_time,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      quantity: 1, // CZSC不提供数量，使用1
      profit: trade.profit,
      profit_rate: trade.profit_rate * 100,       // 乘100转百分比
      direction: 'long' as const // CZSC默认只做多
    }));
  },
};
