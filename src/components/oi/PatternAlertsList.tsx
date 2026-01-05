import React, { memo, useState, useEffect, useCallback } from 'react';
import { Pagination } from 'antd';
import { Dayjs } from 'dayjs';
import { volumeMonitorAPI, PatternAlert } from '../../services/volumeMonitorAPI';
import styles from './PatternAlertsList.module.scss';

interface PatternAlertsListProps {
  searchTerm?: string;
  selectedDate?: Dayjs | null;
  exactMatch?: boolean;
}

// 格式化K线时间
const formatKlineTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 形态类型映射
const PATTERN_TYPE_MAP: Record<string, { label: string; color: string }> = {
  HAMMER_CROSS_EMA: { label: '锤子线穿EMA', color: '#10b981' },
};

export const PatternAlertsList = memo<PatternAlertsListProps>(({ searchTerm = '', selectedDate, exactMatch = false }) => {
  const [alerts, setAlerts] = useState<PatternAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  const fetchAlerts = useCallback(async () => {
    try {
      const params: { limit: number; date?: string } = { limit: 500 };
      if (selectedDate) {
        params.date = selectedDate.format('YYYY-MM-DD');
      }
      const data = await volumeMonitorAPI.getPatternAlerts(params);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch pattern alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 30000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  // 筛选
  const filteredAlerts = alerts.filter(a => {
    if (!searchTerm.trim()) return true;
    const symbol = a.symbol.toLowerCase();
    const term = searchTerm.toLowerCase().trim();
    return exactMatch ? symbol === term : symbol.includes(term);
  });

  // 分页
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const displayData = filteredAlerts.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className={styles.loading}>
        <span>加载中...</span>
      </div>
    );
  }

  if (filteredAlerts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.icon}>🔍</div>
        <p className={styles.text}>暂无形态报警</p>
      </div>
    );
  }

  const paginationElement = filteredAlerts.length > pageSize && (
    <div className={styles.paginationContainer}>
      <Pagination
        current={currentPage}
        pageSize={pageSize}
        total={filteredAlerts.length}
        onChange={setCurrentPage}
        showTotal={(total) => `共 ${total} 条`}
        showSizeChanger={false}
        size="small"
      />
    </div>
  );

  return (
    <>
      {paginationElement}
      <div className={styles.alertList}>
        {displayData.map((alert, index) => {
          const patternInfo = PATTERN_TYPE_MAP[alert.pattern_type] || { label: alert.pattern_type, color: '#6b7280' };
          return (
            <div
              key={`${alert.symbol}-${alert.kline_time}-${index}`}
              className={`${styles.alertItem} ${alert.is_final ? styles.final : styles.pending}`}
            >
              <span className={styles.alertSymbol}>{alert.symbol}</span>
              {alert.daily_alert_index && (
                <span className={styles.alertIndex}>第{alert.daily_alert_index}次</span>
              )}
              <span className={styles.patternType} style={{ color: patternInfo.color }}>
                {patternInfo.label}
              </span>
              <div className={styles.alertMetric}>
                <span className={styles.metricLabel}>K线</span>
                <span className={styles.metricValue}>{formatKlineTime(alert.kline_time)}</span>
              </div>
              <div className={styles.alertMetric}>
                <span className={styles.metricLabel}>下影线</span>
                <span className={styles.metricValue}>{alert.lower_shadow_pct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
      {paginationElement}
    </>
  );
});

PatternAlertsList.displayName = 'PatternAlertsList';
