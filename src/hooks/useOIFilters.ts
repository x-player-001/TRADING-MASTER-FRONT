import { useMemo } from 'react';
import { OIStatisticsResponse, OIAnomaliesResponse, OIAnomaly } from '../types';

interface UseOIFiltersOptions {
  statistics: OIStatisticsResponse | null;
  anomalies: OIAnomaliesResponse | null;
  searchTerm: string;
  minScore: number;
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
  minScore
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

    // 按最低评分筛选
    if (minScore > 0) {
      filtered = filtered.filter(anomaly => {
        const score = anomaly.signal_score !== undefined && anomaly.signal_score !== null
          ? (typeof anomaly.signal_score === 'number' ? anomaly.signal_score : parseFloat(String(anomaly.signal_score)))
          : 0;
        return score >= minScore;
      });
    }

    // 按搜索词筛选
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(anomaly =>
        anomaly.symbol.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [anomalies, searchTerm, minScore]);

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