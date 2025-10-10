import { useState, useEffect, useCallback, useRef } from 'react';
import { Dayjs } from 'dayjs';
import {
  OIStatisticsResponse,
  OIAnomaliesResponse,
  OIServiceStatusData
} from '../types';
import { oiAPI } from '../services/oiAPI';

interface UseOIMonitoringOptions {
  selectedDate: Dayjs | null;
}

interface UseOIMonitoringReturn {
  statistics: OIStatisticsResponse | null;
  anomalies: OIAnomaliesResponse | null;
  serviceStatus: OIServiceStatusData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadingStates: {
    statistics: boolean;
    anomalies: boolean;
    serviceStatus: boolean;
  };
}

export const useOIMonitoring = ({
  selectedDate
}: UseOIMonitoringOptions): UseOIMonitoringReturn => {
  const [statistics, setStatistics] = useState<OIStatisticsResponse | null>(null);
  const [anomalies, setAnomalies] = useState<OIAnomaliesResponse | null>(null);
  const [serviceStatus, setServiceStatus] = useState<OIServiceStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState({
    statistics: false,
    anomalies: false,
    serviceStatus: false
  });

  // 使用ref保存最新的selectedDate，避免useCallback依赖问题
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const fetchData = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
        // 设置分块加载状态
        setLoadingStates({
          statistics: true,
          anomalies: true,
          serviceStatus: true
        });
      }
      setError(null);

      const apiParams = selectedDateRef.current ? { date: selectedDateRef.current.format('YYYY-MM-DD') } : {};

      // 分块获取数据，每个完成后立即更新
      const promises = [
        oiAPI.getOIStatistics(apiParams).then(data => {
          setStatistics(data);
          setLoadingStates(prev => ({ ...prev, statistics: false }));
          return data;
        }),
        oiAPI.getRecentAnomalies(apiParams).then(data => {
          setAnomalies(data);
          setLoadingStates(prev => ({ ...prev, anomalies: false }));
          return data;
        }),
        oiAPI.getOIServiceStatus().then(data => {
          setServiceStatus(data);
          setLoadingStates(prev => ({ ...prev, serviceStatus: false }));
          return data;
        }).catch((err) => {
          console.warn('OI服务状态获取失败:', err);
          setLoadingStates(prev => ({ ...prev, serviceStatus: false }));
          return null;
        })
      ];

      await Promise.all(promises);
    } catch (err) {
      console.error('API请求失败:', err);

      if (isInitialLoad) {
        setError(`获取数据失败: ${err instanceof Error ? err.message : '未知错误'}`);
        setStatistics(null);
        setAnomalies(null);
      } else {
        console.warn('后台数据刷新失败，保持当前数据');
      }

      // 重置所有加载状态
      setLoadingStates({
        statistics: false,
        anomalies: false,
        serviceStatus: false
      });
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []); // 空依赖数组，函数稳定不会重新创建

  const refresh = useCallback(() => fetchData(false), [fetchData]);

  // 记录是否已经完成初次加载
  const [hasInitialized, setHasInitialized] = useState(false);

  // 初次加载效果 - 只在组件挂载时执行
  useEffect(() => {
    fetchData(true).finally(() => setHasInitialized(true));
  }, []); // 空依赖数组，只在挂载时执行

  // 日期变化时的数据获取效果
  useEffect(() => {
    if (hasInitialized) {
      fetchData(false);
    }
  }, [selectedDate]); // 只依赖selectedDate，不依赖fetchData函数

  return {
    statistics,
    anomalies,
    serviceStatus,
    loading,
    isRefreshing,
    error,
    refresh,
    loadingStates
  };
};