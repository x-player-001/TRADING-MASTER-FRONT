import React, { useMemo } from 'react';
import styles from './OIRecentAlerts.module.scss';
import { OIAnomaly } from '../../types/oi';

interface OIRecentAlertsProps {
  anomalies: OIAnomaly[];
}

interface AlertItem {
  symbol: string;
  type: string;
  minutesAgo: number;
  timeInterval: number; // 以5分钟为区间
  timestamp: number; // 用于去重比较
}

const OIRecentAlerts: React.FC<OIRecentAlertsProps> = ({ anomalies }) => {
  // 筛选最近半小时的异常并计算时间，每个代币只保留最近的一次
  const recentAlerts = useMemo((): AlertItem[] => {
    // 空值检查
    if (!anomalies || anomalies.length === 0) {
      return [];
    }

    const now = Date.now();
    const halfHourAgo = now - 30 * 60 * 1000;

    // 先筛选时间范围内的异常
    const filteredAnomalies = anomalies
      .filter(anomaly => {
        const anomalyTimestamp = new Date(anomaly.anomaly_time).getTime();
        return anomalyTimestamp >= halfHourAgo;
      })
      .map(anomaly => {
        const anomalyTimestamp = new Date(anomaly.anomaly_time).getTime();
        const minutesAgo = Math.floor((now - anomalyTimestamp) / 60000);

        return {
          symbol: anomaly.symbol,
          type: anomaly.anomaly_type,
          minutesAgo,
          timeInterval: Math.floor(minutesAgo / 5) * 5, // 以5分钟为区间
          timestamp: anomalyTimestamp
        };
      });

    // 使用Map去重，每个代币只保留时间戳最大（最近）的一个
    const uniqueMap = new Map<string, AlertItem>();
    filteredAnomalies.forEach(item => {
      const existing = uniqueMap.get(item.symbol);
      if (!existing || item.timestamp > existing.timestamp) {
        uniqueMap.set(item.symbol, item);
      }
    });

    // 转换为数组并按时间排序（最老的在前）
    return Array.from(uniqueMap.values())
      .sort((a, b) => a.minutesAgo - b.minutesAgo);
  }, [anomalies]);

  // 异常类型映射
  const typeLabels: Record<string, string> = {
    'spike': '激增',
    'drop': '骤降',
    'volatility': '波动',
    'unusual_change': '异常'
  };

  if (recentAlerts.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>✅</div>
        <div className={styles.emptyText}>最近半小时无异常报警</div>
      </div>
    );
  }

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timelineLabel}>
        <span className={styles.timelineLabelIcon}>⚠️</span>
        <span className={styles.timelineLabelText}>最近30分钟</span>
        <span className={styles.timelineCount}>{recentAlerts.length} 个异常</span>
      </div>
      <div className={styles.timelineScroll}>
        <div className={styles.timelineTrack}>
          {recentAlerts.map((item, index) => {
            // 根据时间区间分配颜色 (0-5分钟, 5-10分钟, ...)
            const getColorClass = (interval: number) => {
              if (interval >= 0 && interval < 5) return styles.interval0;
              if (interval >= 5 && interval < 10) return styles.interval10;
              if (interval >= 10 && interval < 15) return styles.interval20;
              if (interval >= 15 && interval < 20) return styles.interval30;
              if (interval >= 20 && interval < 25) return styles.interval40;
              return styles.interval50;
            };

            return (
              <div
                key={`${item.symbol}-${index}`}
                className={`${styles.timelineItem} ${getColorClass(item.timeInterval)}`}
                title={`${item.symbol} - ${typeLabels[item.type] || item.type} (${item.minutesAgo}分钟前)`}
              >
                <span className={styles.timelineSymbol}>{item.symbol}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OIRecentAlerts;
