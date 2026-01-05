import React, { memo, useState, useEffect, useCallback } from 'react';
import { Pagination } from 'antd';
import { Dayjs } from 'dayjs';
import { volumeMonitorAPI, VolumeAlert } from '../../services/volumeMonitorAPI';
import VolumeImportantAlerts from './VolumeImportantAlerts';
import styles from './VolumeAlertsList.module.scss';

interface VolumeAlertsListProps {
  searchTerm?: string;
  selectedDate?: Dayjs | null;
  exactMatch?: boolean;
}

// 格式化时间 (后端返回的时间已经是UTC+8，去掉Z后缀避免二次转换)
const formatTime = (timestamp: string) => {
  const ts = timestamp.endsWith('Z') ? timestamp.slice(0, -1) : timestamp;
  return new Date(ts).toLocaleString('zh-CN');
};

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

export const VolumeAlertsList = memo<VolumeAlertsListProps>(({ searchTerm = '', selectedDate, exactMatch = false }) => {
  const [alerts, setAlerts] = useState<VolumeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(30);

  const fetchAlerts = useCallback(async () => {
    try {
      const params: { limit: number; date?: string } = { limit: 500 };
      if (selectedDate) {
        params.date = selectedDate.format('YYYY-MM-DD');
      }
      const data = await volumeMonitorAPI.getAlerts(params);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch volume alerts:', err);
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
        <div className={styles.icon}>📊</div>
        <p className={styles.text}>暂无成交量报警</p>
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
      {/* 重要放量报警 */}
      <VolumeImportantAlerts alerts={alerts} />

      {paginationElement}
      <div className={styles.alertList}>
        {displayData.map(alert => (
          <div
            key={alert.id}
            className={`${styles.alertItem} ${alert.direction === 'UP' ? styles.spike : styles.drop}`}
          >
            <div className={styles.alertHeader}>
              <span className={styles.alertSymbol}>
                {alert.symbol}
              </span>
              {alert.daily_alert_index && (
                <span className={styles.alertIndex}>第{alert.daily_alert_index}次</span>
              )}
              <span className={`${styles.alertType} ${alert.direction === 'UP' ? styles.spike : styles.drop}`}>
                {alert.direction === 'UP' ? '放量上涨' : '放量下跌'}
              </span>
              <span className={styles.alertTime}>{formatTime(alert.created_at)}</span>
            </div>
            <div className={styles.alertContent}>
              <div className={styles.alertMetric}>
                <span className={styles.metricLabel}>量比</span>
                <span className={styles.metricValue}>{alert.volume_ratio.toFixed(2)}x</span>
              </div>
              <div className={styles.alertMetric}>
                <span className={styles.metricLabel}>成交量</span>
                <span className={styles.metricValue}>{formatNumber(alert.current_volume)}</span>
              </div>
              <div className={styles.alertMetric}>
                <span className={styles.metricLabel}>价格</span>
                <span className={styles.metricValue}>${alert.current_price.toFixed(4)}</span>
              </div>
              <div className={styles.alertMetric}>
                <span className={styles.metricLabel}>涨跌</span>
                <span className={`${styles.metricValue} ${alert.price_change_pct > 0 ? styles.positive : styles.negative}`}>
                  {alert.price_change_pct > 0 ? '+' : ''}{alert.price_change_pct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {paginationElement}
    </>
  );
});

VolumeAlertsList.displayName = 'VolumeAlertsList';
