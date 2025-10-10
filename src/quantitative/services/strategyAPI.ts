/**
 * 量化交易 - 策略管理API
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../../services/apiClient';
import {
  StrategyConfig,
  StrategyPerformance,
  ToggleStrategyRequest
} from '../types';

export const strategyAPI = {
  /**
   * 获取所有策略
   * GET /api/quant/strategies
   */
  getStrategies: () =>
    apiGet<StrategyConfig[]>('/api/quant/strategies'),

  /**
   * 获取策略详情
   * GET /api/quant/strategies/:id
   */
  getStrategy: (id: number) =>
    apiGet<StrategyConfig>(`/api/quant/strategies/${id}`),

  /**
   * 创建策略
   * POST /api/quant/strategies
   */
  createStrategy: (data: Partial<StrategyConfig>) =>
    apiPost<StrategyConfig>('/api/quant/strategies', data),

  /**
   * 更新策略
   * PUT /api/quant/strategies/:id
   */
  updateStrategy: (id: number, data: Partial<StrategyConfig>) =>
    apiPut<StrategyConfig>(`/api/quant/strategies/${id}`, data),

  /**
   * 删除策略
   * DELETE /api/quant/strategies/:id
   */
  deleteStrategy: (id: number) =>
    apiDelete(`/api/quant/strategies/${id}`),

  /**
   * 启用/禁用策略
   * POST /api/quant/strategies/:id/toggle
   */
  toggleStrategy: (id: number, enabled: boolean) =>
    apiPost<{ success: boolean; message: string }>(
      `/api/quant/strategies/${id}/toggle`,
      { enabled } as ToggleStrategyRequest
    ),

  /**
   * 获取策略性能统计
   * GET /api/quant/strategies/:id/performance
   */
  getPerformance: (id: number) =>
    apiGet<StrategyPerformance>(`/api/quant/strategies/${id}/performance`),
};
