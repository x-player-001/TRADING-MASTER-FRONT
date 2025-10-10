/**
 * 量化交易 - 交易记录API
 */

import { apiGet } from '../../services/apiClient';
import {
  Trade,
  TradeStatistics,
  TradeListParams,
  TradeStatisticsParams
} from '../types';

export const tradeAPI = {
  /**
   * 获取交易记录
   * GET /api/quant/trades
   */
  getTrades: (params?: TradeListParams) =>
    apiGet<Trade[]>('/api/quant/trades', { params }),

  /**
   * 获取交易详情
   * GET /api/quant/trades/:id
   */
  getTradeDetail: (id: number) =>
    apiGet<Trade>(`/api/quant/trades/${id}`),

  /**
   * 获取交易统计
   * GET /api/quant/trades/statistics
   */
  getTradeStatistics: (params?: TradeStatisticsParams) =>
    apiGet<TradeStatistics>('/api/quant/trades/statistics', { params }),

  /**
   * 按回测ID获取交易
   * GET /api/quant/trades/backtest/:backtest_id
   */
  getTradesByBacktest: (backtestId: number) =>
    apiGet<Trade[]>(`/api/quant/trades/backtest/${backtestId}`),
};
