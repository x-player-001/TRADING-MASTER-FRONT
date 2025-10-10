/**
 * 量化交易 - 持仓监控Hook
 */

import { useCallback } from 'react';
import { usePositionStore } from '../stores/positionStore';
import { positionAPI } from '../services';
import { PositionListParams, PositionStatisticsParams } from '../types';

export const usePositionMonitor = () => {
  const {
    positions,
    statistics,
    isLoading,
    error,
    setPositions,
    setStatistics,
    setLoading,
    setError,
  } = usePositionStore();

  // 获取持仓列表
  const fetchPositions = useCallback(async (params?: PositionListParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await positionAPI.getPositions(params);
      setPositions(data);
    } catch (err: any) {
      setError(err.message || '获取持仓列表失败');
    } finally {
      setLoading(false);
    }
  }, [setPositions, setLoading, setError]);

  // 获取持仓统计
  const fetchStatistics = useCallback(async (params?: PositionStatisticsParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await positionAPI.getPositionStatistics(params);
      setStatistics(data);
    } catch (err: any) {
      setError(err.message || '获取持仓统计失败');
    } finally {
      setLoading(false);
    }
  }, [setStatistics, setLoading, setError]);

  // 按策略获取持仓
  const fetchPositionsByStrategy = useCallback(async (strategyId: number, status?: 'open' | 'closed') => {
    setLoading(true);
    setError(null);
    try {
      const data = await positionAPI.getPositionsByStrategy(strategyId, status);
      setPositions(data);
    } catch (err: any) {
      setError(err.message || '获取策略持仓失败');
    } finally {
      setLoading(false);
    }
  }, [setPositions, setLoading, setError]);

  return {
    positions,
    statistics,
    isLoading,
    error,
    fetchPositions,
    fetchStatistics,
    fetchPositionsByStrategy,
  };
};
