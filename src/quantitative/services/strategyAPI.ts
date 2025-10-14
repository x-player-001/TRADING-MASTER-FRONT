/**
 * 量化交易 - 策略管理API（重构版）
 * 完全对接CZSC Position策略系统
 * Base URL: http://localhost:8000/api/v1/strategy
 */

import { czscApiGet, czscApiPost, czscApiPut, czscApiDelete } from '../../services/czscApiClient';
import type {
  CZSCStrategyCreate,
  CZSCStrategyUpdate,
  CZSCStrategy,
  CZSCStrategyListItem,
  CZSCStrategyListResponse
} from '../types/strategy';

export const strategyAPI = {
  /**
   * 创建策略
   * POST /api/v1/strategy
   */
  createStrategy: async (data: CZSCStrategyCreate): Promise<{ strategy_id: string }> => {
    return czscApiPost<{ strategy_id: string }>('/api/v1/strategy', data);
  },

  /**
   * 获取策略列表
   * GET /api/v1/strategy/list
   */
  getStrategies: async (params?: {
    limit?: number;
    offset?: number;
    category?: string;
    author?: string;
  }): Promise<CZSCStrategyListResponse> => {
    return czscApiGet<CZSCStrategyListResponse>('/api/v1/strategy/list', { params });
  },

  /**
   * 获取策略详情
   * GET /api/v1/strategy/{strategy_id}
   */
  getStrategy: async (strategyId: string): Promise<CZSCStrategy> => {
    return czscApiGet<CZSCStrategy>(`/api/v1/strategy/${strategyId}`);
  },

  /**
   * 更新策略
   * PUT /api/v1/strategy/{strategy_id}
   */
  updateStrategy: async (strategyId: string, data: CZSCStrategyUpdate): Promise<{ success: boolean; message: string }> => {
    return czscApiPut<{ success: boolean; message: string }>(`/api/v1/strategy/${strategyId}`, data);
  },

  /**
   * 删除策略
   * DELETE /api/v1/strategy/{strategy_id}
   */
  deleteStrategy: async (strategyId: string, hardDelete = false): Promise<{ success: boolean; message: string }> => {
    return czscApiDelete<{ success: boolean; message: string }>(`/api/v1/strategy/${strategyId}`, {
      params: { hard_delete: hardDelete }
    });
  }
};
