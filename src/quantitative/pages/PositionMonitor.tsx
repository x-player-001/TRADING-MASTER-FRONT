/**
 * 持仓监控页面
 */

import React, { useEffect } from 'react';
import { Table } from 'antd';
import PageHeader from '../../components/ui/PageHeader';
import { usePositionMonitor } from '../hooks/usePositionMonitor';
import { formatCurrency, formatTradeSide, formatDateTime, formatPositionStatus } from '../utils';
import styles from './PositionMonitor.module.scss';

interface PositionMonitorProps {
  isSidebarCollapsed?: boolean;
}

const PositionMonitor: React.FC<PositionMonitorProps> = ({ isSidebarCollapsed }) => {
  const { positions, statistics, fetchPositions, fetchStatistics } = usePositionMonitor();

  useEffect(() => {
    fetchPositions({ status: 'open' });
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
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '未实现盈亏',
      dataIndex: 'unrealized_pnl',
      key: 'unrealized_pnl',
      render: (pnl: number) => (
        <span className={pnl >= 0 ? styles.positive : styles.negative}>
          {formatCurrency(pnl)}
        </span>
      ),
    },
    {
      title: '止损',
      dataIndex: 'stop_loss',
      key: 'stop_loss',
      render: (price: number) => formatCurrency(price),
    },
    {
      title: '止盈',
      dataIndex: 'take_profit',
      key: 'take_profit',
      render: (price: number) => formatCurrency(price),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => formatPositionStatus(status),
    },
  ];

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="持仓监控"
        subtitle="实时监控持仓状态和未实现盈亏"
        icon="💼"
      />

      {statistics && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.label}>总持仓</div>
            <div className={styles.value}>{statistics.total_positions}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>持仓中</div>
            <div className={styles.value}>{statistics.open_positions}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>未实现盈亏</div>
            <div className={`${styles.value} ${statistics.total_unrealized_pnl >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(statistics.total_unrealized_pnl)}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>已实现盈亏</div>
            <div className={`${styles.value} ${statistics.total_realized_pnl >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(statistics.total_realized_pnl)}
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <Table
          dataSource={positions}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </div>
    </div>
  );
};

export default PositionMonitor;
