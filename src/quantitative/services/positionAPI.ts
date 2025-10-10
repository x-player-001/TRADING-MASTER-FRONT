/**
 * 量化交易 - 持仓管理API
 */

import { apiGet } from '../../services/apiClient';
import {
  Position,
  PositionStatistics,
  PositionListParams,
  PositionStatisticsParams
} from '../types';

export const positionAPI = {
  /**
   * 获取持仓列表
   * GET /api/quant/positions
   */
  getPositions: (params?: PositionListParams) =>
    apiGet<Position[]>('/api/quant/positions', { params }),

  /**
   * 获取持仓详情
   * GET /api/quant/positions/:id
   */
  getPositionDetail: (id: number) =>
    apiGet<Position>(`/api/quant/positions/${id}`),

  /**
   * 获取持仓统计
   * GET /api/quant/positions/statistics
   */
  getPositionStatistics: (params?: PositionStatisticsParams) =>
    apiGet<PositionStatistics>('/api/quant/positions/statistics', { params }),

  /**
   * 按策略获取持仓
   * GET /api/quant/positions/strategy/:strategy_id
   */
  getPositionsByStrategy: (strategyId: number, status?: 'open' | 'closed') =>
    apiGet<Position[]>(`/api/quant/positions/strategy/${strategyId}`, {
      params: { status }
    }),
};
