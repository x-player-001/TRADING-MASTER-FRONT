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

  // 格式化资金费率变化
  const fundingRateChangePercent = anomaly.funding_rate_change_percent
    ? parseFloat(anomaly.funding_rate_change_percent).toFixed(2)
    : null;

  return (
    <div className={`${styles.anomalyItem} ${severityClass}`}>
      {/* 第一行：币种 + 时间段 + 时间戳 */}
      <div className={styles.firstLine}>
        <span className={styles.symbol}>{anomaly.symbol}</span>
        <span className={styles.period}>{anomaly.period_minutes}分钟</span>
        <span className={styles.timestamp}>
          {formatTimestamp(anomaly.anomaly_time)}
        </span>
      </div>

      {/* 第二行：OI和价格变化 */}
      <div className={styles.secondLine}>
        <span className={styles.changeItem}>
          OI:
          <span className={`${styles.changeText} ${anomaly.percent_change > 0 ? styles.increase : styles.decrease}`}>
            {anomaly.percent_change > 0 ? '+' : ''}{oiChangeInfo.percentage}%
          </span>
          <span className={styles.detailText}>
            （{oiChangeInfo.beforeFormatted} → {oiChangeInfo.afterFormatted}）
          </span>
        </span>
        {priceChangePercent && (
          <span className={styles.changeItem}>
            price:
            <span className={`${styles.changeText} ${parseFloat(priceChangePercent) > 0 ? styles.increase : styles.decrease}`}>
              {parseFloat(priceChangePercent) > 0 ? '+' : ''}{priceChangePercent}%
            </span>
            {anomaly.price_before && anomaly.price_after && (
              <span className={styles.detailText}>
                ({parseFloat(anomaly.price_before).toFixed(6)} → {parseFloat(anomaly.price_after).toFixed(6)})
              </span>
            )}
          </span>
        )}
        {fundingRateChangePercent && (
          <span className={styles.changeItem}>
            funding:
            <span className={`${styles.changeText} ${parseFloat(fundingRateChangePercent) > 0 ? styles.increase : styles.decrease}`}>
              {parseFloat(fundingRateChangePercent) > 0 ? '+' : ''}{fundingRateChangePercent}%
            </span>
            {anomaly.funding_rate_before && anomaly.funding_rate_after && (
              <span className={styles.detailText}>
                ({(parseFloat(anomaly.funding_rate_before) * 100).toFixed(4)}% → {(parseFloat(anomaly.funding_rate_after) * 100).toFixed(4)}%)
              </span>
            )}
          </span>
        )}
      </div>

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