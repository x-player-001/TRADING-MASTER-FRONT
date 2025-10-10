/**
 * 量化交易 - 回测系统API
 */

import { apiGet, apiPost, apiDelete } from '../../services/apiClient';
import {
  BacktestRequest,
  BacktestResult,
  BacktestListParams,
  BestMetric,
  Trade,
  BacktestTaskResponse,
  BacktestTask,
  TaskListParams
} from '../types';

export const backtestAPI = {
  /**
   * 运行回测（异步任务模式）
   * POST /api/quant/backtest/run
   * @returns 立即返回任务ID，需要轮询获取结果
   */
  runBacktest: (data: BacktestRequest) =>
    apiPost<BacktestTaskResponse>('/api/quant/backtest/run', data),

  /**
   * 查询任务状态和进度
   * GET /api/quant/backtest/tasks/:task_id
   */
  getTaskStatus: (taskId: string) =>
    apiGet<BacktestTask>(`/api/quant/backtest/tasks/${taskId}`),

  /**
   * 获取任务列表
   * GET /api/quant/backtest/tasks
   */
  getTaskList: (params?: TaskListParams) =>
    apiGet<BacktestTask[]>('/api/quant/backtest/tasks', { params }),

  /**
   * 取消任务
   * DELETE /api/quant/backtest/tasks/:task_id
   */
  cancelTask: (taskId: string) =>
    apiDelete(`/api/quant/backtest/tasks/${taskId}`),

  /**
   * 获取回测结果列表
   * GET /api/quant/backtest/results
   */
  getBacktestResults: (params?: BacktestListParams) =>
    apiGet<BacktestResult[]>('/api/quant/backtest/results', { params }),

  /**
   * 获取回测详情
   * GET /api/quant/backtest/results/:id
   */
  getBacktestDetail: (id: number) =>
    apiGet<BacktestResult>(`/api/quant/backtest/results/${id}`),

  /**
   * 获取回测交易明细
   * GET /api/quant/backtest/results/:id/trades
   */
  getBacktestTrades: (id: number) =>
    apiGet<Trade[]>(`/api/quant/backtest/results/${id}/trades`),

  /**
   * 获取策略最佳回测
   * GET /api/quant/backtest/best/:strategy_id
   */
  getBestBacktest: (strategyId: number, metric: BestMetric = 'sharpe_ratio') =>
    apiGet<BacktestResult>(`/api/quant/backtest/best/${strategyId}`, {
      params: { metric }
    }),

  /**
   * 按币种获取回测
   * GET /api/quant/backtest/symbol/:symbol
   */
  getBacktestBySymbol: (symbol: string, interval?: string) =>
    apiGet<BacktestResult[]>(`/api/quant/backtest/symbol/${symbol}`, {
      params: { interval }
    }),

  /**
   * 删除回测记录
   * DELETE /api/quant/backtest/results/:id
   */
  deleteBacktest: (id: number) =>
    apiDelete(`/api/quant/backtest/results/${id}`),
};
