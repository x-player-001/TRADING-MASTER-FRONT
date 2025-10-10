/**
 * 量化交易 - 风险检查Hook
 */

import { useCallback } from 'react';
import { useRiskStore } from '../stores/riskStore';
import { riskAPI } from '../services';
import { RiskConfig, RiskExposureParams, RiskCheckParams } from '../types';

export const useRiskCheck = () => {
  const {
    config,
    exposure,
    checkResult,
    isLoading,
    error,
    setConfig,
    setExposure,
    setCheckResult,
    setLoading,
    setError,
  } = useRiskStore();

  // 获取风控配置
  const fetchConfig = useCallback(async (strategyId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await riskAPI.getRiskConfig(strategyId);
      setConfig(data);
    } catch (err: any) {
      setError(err.message || '获取风控配置失败');
    } finally {
      setLoading(false);
    }
  }, [setConfig, setLoading, setError]);

  // 更新风控配置
  const updateConfig = useCallback(async (strategyId: number, data: Partial<RiskConfig>) => {
    setLoading(true);
    setError(null);
    try {
      await riskAPI.updateRiskConfig(strategyId, data);
      setConfig({ ...config!, ...data });
    } catch (err: any) {
      setError(err.message || '更新风控配置失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config, setConfig, setLoading, setError]);

  // 获取风险敞口
  const fetchExposure = useCallback(async (params: RiskExposureParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await riskAPI.getRiskExposure(params);
      setExposure(data);
    } catch (err: any) {
      setError(err.message || '获取风险敞口失败');
    } finally {
      setLoading(false);
    }
  }, [setExposure, setLoading, setError]);

  // 检查开仓风险
  const checkRisk = useCallback(async (strategyId: number, params: Omit<RiskCheckParams, 'strategy_id'>) => {
    setLoading(true);
    setError(null);
    try {
      const data = await riskAPI.checkRisk(strategyId, params);
      setCheckResult(data);
      return data;
    } catch (err: any) {
      setError(err.message || '风险检查失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setCheckResult, setLoading, setError]);

  return {
    config,
    exposure,
    checkResult,
    isLoading,
    error,
    fetchConfig,
    updateConfig,
    fetchExposure,
    checkRisk,
  };
};
