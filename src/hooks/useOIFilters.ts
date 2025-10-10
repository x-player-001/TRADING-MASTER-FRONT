import { useMemo } from 'react';
import { OIStatisticsResponse, OIAnomaliesResponse, OIAnomaly } from '../types';

interface UseOIFiltersOptions {
  statistics: OIStatisticsResponse | null;
  anomalies: OIAnomaliesResponse | null;
  searchTerm: string;
  severityFilter: 'all' | 'high' | 'medium' | 'low';
}

interface UseOIFiltersReturn {
  filteredStatistics: OIStatisticsResponse;
  filteredAnomalies: OIAnomaliesResponse;
  counts: {
    originalStatistics: number;
    filteredStatistics: number;
    originalAnomalies: number;
    filteredAnomalies: number;
  };
}

/**
 * 自定义Hook: 处理OI数据的筛选逻辑
 * 使用useMemo缓存筛选结果，避免不必要的重复计算
 */
export const useOIFilters = ({
  statistics,
  anomalies,
  searchTerm,
  severityFilter
}: UseOIFiltersOptions): UseOIFiltersReturn => {
  // 筛选统计数据
  const filteredStatistics = useMemo(() => {
    if (!statistics || !Array.isArray(statistics)) return [];

    if (!searchTerm.trim()) return statistics;

    const term = searchTerm.toLowerCase().trim();
    return statistics.filter(stat =>
      stat.symbol.toLowerCase().includes(term)
    );
  }, [statistics, searchTerm]);

  // 筛选异常数据
  const filteredAnomalies = useMemo(() => {
    if (!anomalies || !Array.isArray(anomalies)) return [];

    let filtered = anomalies;

    // 按严重程度筛选
    if (severityFilter !== 'all') {
      filtered = filtered.filter(anomaly => anomaly.severity === severityFilter);
    }

    // 按搜索词筛选
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(anomaly =>
        anomaly.symbol.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [anomalies, searchTerm, severityFilter]);

  // 计算数量统计
  const counts = useMemo(() => ({
    originalStatistics: statistics?.length || 0,
    filteredStatistics: filteredStatistics.length,
    originalAnomalies: anomalies?.length || 0,
    filteredAnomalies: filteredAnomalies.length
  }), [statistics, anomalies, filteredStatistics, filteredAnomalies]);

  return {
    filteredStatistics,
    filteredAnomalies,
    counts
  };
};