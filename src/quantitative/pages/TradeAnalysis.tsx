/**
 * 交易分析页面
 */

import React, { useEffect } from 'react';
import { Table } from 'antd';
import PageHeader from '../../components/ui/PageHeader';
import { useTradeStatistics } from '../hooks/useTradeStatistics';
import { formatCurrency, formatPercent, formatDateTime, formatTradeSide, formatExitReason } from '../utils';
import styles from './TradeAnalysis.module.scss';

interface TradeAnalysisProps {
  isSidebarCollapsed?: boolean;
}

const TradeAnalysis: React.FC<TradeAnalysisProps> = ({ isSidebarCollapsed }) => {
  const { trades, statistics, fetchTrades, fetchStatistics } = useTradeStatistics();

  useEffect(() => {
    fetchTrades({ limit: 100 });
    fetchStatistics();
  }, []);

  const columns = [
    { title: '币种', dataIndex: 'symbol', key: 'symbol' },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <span className={side === 'LONG' ? styles.long : styles.short}>
          {formatTradeSide(side)}
        </span>
      ),
    },
    {
      title: '入场价',
      dataIndex: 'entry_price',
      key: 'entry_price',
      render: (price: number) => formatCurrency(price),
    },
    {
      title: '出场价',
      dataIndex: 'exit_price',
      key: 'exit_price',
      render: (price: number) => formatCurrency(price),
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (pnl: number) => (
        <span className={pnl >= 0 ? styles.positive : styles.negative}>
          {formatCurrency(pnl)}
        </span>
      ),
    },
    {
      title: '出场原因',
      dataIndex: 'exit_reason',
      key: 'exit_reason',
      render: (reason: string) => formatExitReason(reason),
    },
    {
      title: '入场时间',
      dataIndex: 'entry_time',
      key: 'entry_time',
      render: (time: string) => formatDateTime(time),
    },
  ];

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="交易分析"
        subtitle="查看历史交易记录和统计分析"
        icon="📈"
      />

      {/* 统计卡片 */}
      {statistics && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.label}>总交易数</div>
            <div className={styles.value}>{statistics.total_trades}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>胜率</div>
            <div className={styles.value}>{formatPercent(statistics.win_rate)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>总盈亏</div>
            <div className={`${styles.value} ${statistics.total_pnl >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(statistics.total_pnl)}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>盈亏比</div>
            <div className={styles.value}>{statistics.profit_factor.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* 交易表格 */}
      <div className={styles.card}>
        <Table
          dataSource={trades}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </div>
    </div>
  );
};

export default TradeAnalysis;
