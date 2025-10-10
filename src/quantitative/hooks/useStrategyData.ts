/**
 * 量化交易 - 策略数据Hook
 */

import { useEffect, useCallback } from 'react';
import { useStrategyStore } from '../stores/strategyStore';
import { strategyAPI } from '../services';
import { StrategyConfig } from '../types';

export const useStrategyData = () => {
  const {
    strategies,
    selectedStrategy,
    performance,
    isLoading,
    error,
    setStrategies,
    addStrategy,
    updateStrategy,
    removeStrategy,
    selectStrategy,
    setPerformance,
    setLoading,
    setError,
  } = useStrategyStore();

  // 获取所有策略
  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await strategyAPI.getStrategies();
      setStrategies(data);
    } catch (err: any) {
      setError(err.message || '获取策略列表失败');
    } finally {
      setLoading(false);
    }
  }, [setStrategies, setLoading, setError]);

  // 创建策略
  const createStrategy = useCallback(async (data: Partial<StrategyConfig>) => {
    setLoading(true);
    setError(null);
    try {
      const newStrategy = await strategyAPI.createStrategy(data);
      addStrategy(newStrategy);
      return newStrategy;
    } catch (err: any) {
      setError(err.message || '创建策略失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addStrategy, setLoading, setError]);

  // 更新策略
  const modifyStrategy = useCallback(async (id: number, data: Partial<StrategyConfig>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await strategyAPI.updateStrategy(id, data);
      updateStrategy(id, updated);
      return updated;
    } catch (err: any) {
      setError(err.message || '更新策略失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateStrategy, setLoading, setError]);

  // 删除策略
  const deleteStrategy = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await strategyAPI.deleteStrategy(id);
      removeStrategy(id);
    } catch (err: any) {
      setError(err.message || '删除策略失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [removeStrategy, setLoading, setError]);

  // 启用/禁用策略
  const toggleStrategy = useCallback(async (id: number, enabled: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await strategyAPI.toggleStrategy(id, enabled);
      updateStrategy(id, { enabled });
    } catch (err: any) {
      setError(err.message || '切换策略状态失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateStrategy, setLoading, setError]);

  // 获取策略性能
  const fetchPerformance = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await strategyAPI.getPerformance(id);
      setPerformance(data);
    } catch (err: any) {
      setError(err.message || '获取性能统计失败');
    } finally {
      setLoading(false);
    }
  }, [setPerformance, setLoading, setError]);

  // 初始加载
  useEffect(() => {
    fetchStrategies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  return {
    strategies,
    selectedStrategy,
    performance,
    isLoading,
    error,
    selectStrategy,
    fetchStrategies,
    createStrategy,
    modifyStrategy,
    deleteStrategy,
    toggleStrategy,
    fetchPerformance,
  };
};
