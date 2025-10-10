/**
 * 量化交易 - 风险管理API
 */

import { apiGet, apiPut } from '../../services/apiClient';
import {
  RiskConfig,
  RiskExposure,
  RiskCheckResult,
  RiskExposureParams,
  RiskCheckParams
} from '../types';

export const riskAPI = {
  /**
   * 获取风控配置
   * GET /api/quant/risk/config/:strategy_id
   */
  getRiskConfig: (strategyId: number) =>
    apiGet<RiskConfig>(`/api/quant/risk/config/${strategyId}`),

  /**
   * 更新风控配置
   * PUT /api/quant/risk/config/:strategy_id
   */
  updateRiskConfig: (strategyId: number, data: Partial<RiskConfig>) =>
    apiPut<{ success: boolean; message: string }>(
      `/api/quant/risk/config/${strategyId}`,
      data
    ),

  /**
   * 获取风险敞口
   * GET /api/quant/risk/exposure
   */
  getRiskExposure: (params: RiskExposureParams) =>
    apiGet<RiskExposure>('/api/quant/risk/exposure', { params }),

  /**
   * 检查开仓风险
   * GET /api/quant/risk/check/:strategy_id
   */
  checkRisk: (strategyId: number, params: Omit<RiskCheckParams, 'strategy_id'>) =>
    apiGet<RiskCheckResult>(`/api/quant/risk/check/${strategyId}`, { params }),
};
