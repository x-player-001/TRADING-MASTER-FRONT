import React, { memo, useState } from 'react';
import { Dayjs } from 'dayjs';
import { OIStatistics } from '../../types';
import { formatPercentage, formatTimestamp } from '../../utils/oiFormatters';
import OICurveChart from './OICurveChart';
import styles from './OIStatisticsTable.module.scss';

interface OIStatisticsTableProps {
  data: OIStatistics[];
  maxRows?: number;
  initialDate?: Dayjs | null;
}

/**
 * OI统计数据表格组件
 * 使用React.memo优化，仅在data变化时重新渲染
 */
export const OIStatisticsTable = memo<OIStatisticsTableProps>(({
  data,
  maxRows = 30,
  initialDate
}) => {
  const [curveModalVisible, setCurveModalVisible] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [firstAnomalyTime, setFirstAnomalyTime] = useState<string | null>(null);
  const [lastAnomalyTime, setLastAnomalyTime] = useState<string | null>(null);

  const handleViewCurve = (symbol: string, firstAnomaly: string | null, lastAnomaly: string | null) => {
    // API需要完整的symbol（带USDT后缀）
    const fullSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    setSelectedSymbol(fullSymbol);
    setFirstAnomalyTime(firstAnomaly);
    setLastAnomalyTime(lastAnomaly);
    setCurveModalVisible(true);
  };

  const handleCloseCurve = () => {
    setCurveModalVisible(false);
    setSelectedSymbol('');
    setFirstAnomalyTime(null);
    setLastAnomalyTime(null);
  };

  if (!data || data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.icon}>📊</div>
        <p className={styles.text}>暂无统计数据</p>
      </div>
    );
  }

  const displayData = data.slice(0, maxRows);

  return (
    <>
      <div className={styles.tableContainer}>
        <table className={styles.statisticsTable}>
          <thead>
            <tr>
              <th>币种</th>
              <th>24h变化</th>
              <th>异常次数</th>
              <th>首次异常时间</th>
              <th>最后异常时间</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((stat) => (
              <TableRow
                key={stat.symbol}
                stat={stat}
                onViewCurve={handleViewCurve}
              />
            ))}
          </tbody>
        </table>
      </div>

      <OICurveChart
        visible={curveModalVisible}
        symbol={selectedSymbol}
        onClose={handleCloseCurve}
        initialDate={initialDate}
        firstAnomalyTime={firstAnomalyTime}
        lastAnomalyTime={lastAnomalyTime}
      />
    </>
  );
});

/**
 * 表格行组件 - 单独抽离以便优化渲染
 */
const TableRow = memo<{
  stat: OIStatistics;
  onViewCurve: (symbol: string, firstAnomaly: string | null, lastAnomaly: string | null) => void;
}>(({ stat, onViewCurve }) => {
  const changeValue = parseFloat(stat.daily_change_pct);
  const isPositive = changeValue >= 0;

  return (
    <tr className={styles.tableRow}>
      <td
        className={styles.symbolCell}
        onClick={() => onViewCurve(stat.symbol, stat.first_anomaly_time, stat.last_anomaly_time)}
      >
        <span className={styles.symbolName} title="点击查看OI曲线">
          {stat.symbol}
        </span>
      </td>
      <td className={styles.changeCell}>
        <span className={`${styles.changeValue} ${isPositive ? styles.positive : styles.negative}`}>
          {formatPercentage(changeValue)}
        </span>
      </td>
      <td className={styles.anomalyCell}>
        <span className={`${styles.anomalyCount} ${stat.anomaly_count_24h > 0 ? styles.warning : ''}`}>
          {stat.anomaly_count_24h}
        </span>
      </td>
      <td className={styles.timeCell}>
        {stat.first_anomaly_time ? (
          <span className={styles.timeValue}>
            {formatTimestamp(stat.first_anomaly_time)}
          </span>
        ) : (
          <span className={styles.noData}>-</span>
        )}
      </td>
      <td className={styles.timeCell}>
        {stat.last_anomaly_time ? (
          <span className={styles.timeValue}>
            {formatTimestamp(stat.last_anomaly_time)}
          </span>
        ) : (
          <span className={styles.noData}>-</span>
        )}
      </td>
    </tr>
  );
});

TableRow.displayName = 'TableRow';
OIStatisticsTable.displayName = 'OIStatisticsTable';