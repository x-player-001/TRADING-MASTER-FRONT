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

  // 格式化价格变化
  const priceChangePercent = anomaly.price_change_percent
    ? parseFloat(anomaly.price_change_percent).toFixed(2)
    : null;

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

      {/* OI变化信息 */}
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

      {/* 价格变化信息 */}
      {priceChangePercent && (
        <p className={styles.priceInfo}>
          <span className={styles.label}>价格变化:</span>
          <span className={`${styles.priceChange} ${parseFloat(priceChangePercent) > 0 ? styles.increase : styles.decrease}`}>
            {parseFloat(priceChangePercent) > 0 ? '+' : ''}{priceChangePercent}%
          </span>
          {anomaly.price_before && anomaly.price_after && (
            <span className={styles.priceDetail}>
              ({parseFloat(anomaly.price_before).toFixed(6)} → {parseFloat(anomaly.price_after).toFixed(6)})
            </span>
          )}
        </p>
      )}

      {/* 多空比数据 */}
      {(anomaly.top_trader_long_short_ratio || anomaly.top_account_long_short_ratio || anomaly.global_long_short_ratio || anomaly.taker_buy_sell_ratio) && (
        <div className={styles.ratioInfo}>
          {anomaly.top_trader_long_short_ratio && (
            <span className={styles.ratioItem}>
              <span className={styles.ratioLabel}>大户多空比:</span>
              <span className={styles.ratioValue}>{parseFloat(anomaly.top_trader_long_short_ratio).toFixed(2)}</span>
            </span>
          )}
          {anomaly.top_account_long_short_ratio && (
            <span className={styles.ratioItem}>
              <span className={styles.ratioLabel}>大户账户多空比:</span>
              <span className={styles.ratioValue}>{parseFloat(anomaly.top_account_long_short_ratio).toFixed(2)}</span>
            </span>
          )}
          {anomaly.global_long_short_ratio && (
            <span className={styles.ratioItem}>
              <span className={styles.ratioLabel}>全局多空比:</span>
              <span className={styles.ratioValue}>{parseFloat(anomaly.global_long_short_ratio).toFixed(2)}</span>
            </span>
          )}
          {anomaly.taker_buy_sell_ratio && (
            <span className={styles.ratioItem}>
              <span className={styles.ratioLabel}>主动买卖比:</span>
              <span className={styles.ratioValue}>{parseFloat(anomaly.taker_buy_sell_ratio).toFixed(2)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
});

AnomalyItem.displayName = 'AnomalyItem';
OIAnomaliesList.displayName = 'OIAnomaliesList';