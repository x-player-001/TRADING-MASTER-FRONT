import React, { memo, useState, useEffect, useRef } from 'react';
import { Pagination } from 'antd';
import { Dayjs } from 'dayjs';
import { OIStatistics } from '../../types';
import { formatPercentage, formatTimestamp } from '../../utils/oiFormatters';
import OICurveChart from './OICurveChart';
import styles from './OIStatisticsTable.module.scss';

interface OIStatisticsTableProps {
  data: OIStatistics[];
  initialDate?: Dayjs | null;
}

/**
 * OI统计数据表格组件
 * 使用React.memo优化，仅在data变化时重新渲染
 * 支持增量更新和淡入动画
 */
export const OIStatisticsTable = memo<OIStatisticsTableProps>(({
  data,
  initialDate
}) => {
  const [curveModalVisible, setCurveModalVisible] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [firstAnomalyTime, setFirstAnomalyTime] = useState<string | null>(null);
  const [lastAnomalyTime, setLastAnomalyTime] = useState<string | null>(null);

  const [displayData, setDisplayData] = useState<OIStatistics[]>([]);
  const [newItemSymbols, setNewItemSymbols] = useState<Set<string>>(new Set());
  const prevDataRef = useRef<Map<string, OIStatistics>>(new Map());

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // 当数据变化时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  useEffect(() => {
    if (!data || data.length === 0) {
      setDisplayData([]);
      prevDataRef.current.clear();
      return;
    }

    // 分页逻辑
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentData = data.slice(startIndex, endIndex);

    const currentMap = new Map(currentData.map(item => [item.symbol, item]));
    const prevMap = prevDataRef.current;

    // 找出新增或更新的项
    const newSymbols = new Set<string>();
    currentData.forEach(item => {
      const prev = prevMap.get(item.symbol);
      // 新增或数据变化（通过异常次数判断）
      if (!prev || prev.anomaly_count !== item.anomaly_count) {
        newSymbols.add(item.symbol);
      }
    });

    // 更新显示数据
    setDisplayData(currentData);
    setNewItemSymbols(newSymbols);

    // 更新引用
    prevDataRef.current = currentMap;

    // 300ms后清除新增标记
    if (newSymbols.size > 0) {
      const timer = setTimeout(() => {
        setNewItemSymbols(new Set());
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data, currentPage, pageSize]);

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

  const paginationElement = data && data.length > 0 && (
    <div className={styles.paginationContainer}>
      <Pagination
        current={currentPage}
        pageSize={pageSize}
        total={data.length}
        onChange={setCurrentPage}
        showTotal={(total) => `共 ${total} 条`}
        size="small"
      />
    </div>
  );

  return (
    <>
      {/* 顶部分页 */}
      {paginationElement}

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
            {displayData.map((stat) => {
              const isNew = newItemSymbols.has(stat.symbol);
              return (
                <TableRow
                  key={stat.symbol}
                  stat={stat}
                  onViewCurve={handleViewCurve}
                  isNew={isNew}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 底部分页 */}
      {paginationElement}

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
  isNew?: boolean;
}>(({ stat, onViewCurve, isNew = false }) => {
  const changeValue = parseFloat(stat.daily_change_pct);
  const isPositive = changeValue >= 0;

  return (
    <tr className={`${styles.tableRow} ${isNew ? styles.newRow : ''}`}>
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