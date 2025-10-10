import React, { memo } from 'react';
import { OIAnomaly } from '../../types';
import { formatOIChange, formatTimestamp } from '../../utils/oiFormatters';
import styles from './OIAnomaliesList.module.scss';

interface OIAnomaliesListProps {
  data: OIAnomaly[];
  maxRows?: number;
}

/**
 * OI异常列表组件
 * 使用React.memo优化，仅在data变化时重新渲染
 */
export const OIAnomaliesList = memo<OIAnomaliesListProps>(({
  data,
  maxRows = 30
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.icon}>✅</div>
        <p className={styles.text}>暂无异常检测</p>
      </div>
    );
  }

  const displayData = data.slice(0, maxRows);

  return (
    <div className={styles.anomalyList}>
      {displayData.map((anomaly, index) => (
        <AnomalyItem
          key={`${anomaly.symbol}-${anomaly.anomaly_time}-${index}`}
          anomaly={anomaly}
        />
      ))}
    </div>
  );
});

/**
 * 异常项组件 - 单独抽离以便优化渲染
 */
const AnomalyItem = memo<{ anomaly: OIAnomaly }>(({ anomaly }) => {
  const oiChangeInfo = formatOIChange(
    anomaly.percent_change,
    anomaly.oi_before,
    anomaly.oi_after
  );

  const severityClass = styles[anomaly.severity] || styles.medium;

  return (
    <div className={`${styles.anomalyItem} ${severityClass}`}>
      <div className={styles.anomalyHeader}>
        <div className={styles.anomalyInfo}>
          <span className={styles.symbol}>{anomaly.symbol}</span>
          <span className={styles.type}>
            {anomaly.period_minutes}分钟异常
          </span>
        </div>
        <span className={styles.timestamp}>
          {formatTimestamp(anomaly.anomaly_time)}
        </span>
      </div>
      <p className={styles.message}>
        OI在{anomaly.period_minutes}分钟内
        <span className={`${styles.changeText} ${anomaly.percent_change > 0 ? styles.increase : styles.decrease}`}>
          {oiChangeInfo.direction} {oiChangeInfo.percentage}%
        </span>
        <span className={styles.detailText}>
          （{oiChangeInfo.beforeFormatted} → {oiChangeInfo.afterFormatted}，
          变化量 {oiChangeInfo.changeFormatted}）
        </span>
      </p>
    </div>
  );
});

AnomalyItem.displayName = 'AnomalyItem';
OIAnomaliesList.displayName = 'OIAnomaliesList';