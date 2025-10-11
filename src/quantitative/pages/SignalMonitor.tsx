/**
 * 信号监控页面
 * 展示缠论信号监控和分析功能
 */

import React, { useState, useEffect } from 'react';
import { Select, message, Tag, Table, Space, Button, Card, Statistic, Row, Col, Divider } from 'antd';
import { SyncOutlined, ThunderboltOutlined, RiseOutlined, FallOutlined, BarChartOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/ui/PageHeader';
import {
  czscSignalAPI,
  signalMonitorUtils,
  SignalRecord,
  SignalSummaryResponse,
} from '../../services/czscSignalAPI';
import styles from './SignalMonitor.module.scss';

interface SignalMonitorProps {
  isSidebarCollapsed?: boolean;
}

const SignalMonitor: React.FC<SignalMonitorProps> = ({ isSidebarCollapsed }) => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [latestSignals, setLatestSignals] = useState<SignalRecord[]>([]);
  const [querySignals, setQuerySignals] = useState<SignalRecord[]>([]);
  const [summary, setSummary] = useState<SignalSummaryResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // 查询过滤条件
  const [querySymbol, setQuerySymbol] = useState<string>('BTCUSDT');
  const [queryFreq, setQueryFreq] = useState<string>('15m');

  // 周期选项
  const freqOptions = [
    { label: '1分钟', value: '1m' },
    { label: '5分钟', value: '5m' },
    { label: '15分钟', value: '15m' },
    { label: '30分钟', value: '30m' },
    { label: '1小时', value: '1h' },
    { label: '4小时', value: '4h' },
    { label: '1天', value: '1d' },
    { label: '1周', value: '1w' },
  ];

  // 加载最新信号（页面上方，混合多币种多周期）
  const loadLatestSignals = async () => {
    try {
      // 获取BTCUSDT 15m的最新10条信号
      const response = await czscSignalAPI.querySignalsGet({
        symbol: 'BTCUSDT',
        freq: '15m',
        limit: 10,
      });
      setLatestSignals(response.signals || []);
    } catch (error: any) {
      console.error('加载最新信号失败:', error);
    }
  };

  // 查询指定币种周期的信号（页面下方）
  const loadQuerySignals = async () => {
    if (!querySymbol || !queryFreq) {
      message.warning('请选择标的和周期');
      return;
    }

    setLoading(true);
    try {
      const [signalsRes, summaryRes] = await Promise.all([
        czscSignalAPI.querySignalsGet({
          symbol: querySymbol,
          freq: queryFreq,
          limit: 100,
        }),
        czscSignalAPI.getSignalSummary({
          symbol: querySymbol,
          freq: queryFreq,
        }),
      ]);

      setQuerySignals(signalsRes.signals || []);
      setSummary(summaryRes);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时获取最新信号
  useEffect(() => {
    loadLatestSignals();
    // 每30秒刷新一次最新信号
    const interval = setInterval(loadLatestSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  // 刷新所有数据
  const handleRefresh = () => {
    loadLatestSignals();
    if (querySymbol && queryFreq) {
      loadQuerySignals();
    }
  };

  // 查询按钮
  const handleQuery = () => {
    setCurrentPage(1);
    loadQuerySignals();
  };

  // 最新信号表格列定义
  const latestColumns: ColumnsType<SignalRecord> = [
    {
      title: '时间',
      dataIndex: 'signal_time',
      key: 'signal_time',
      width: 180,
      fixed: 'left',
      render: (text) => text ? signalMonitorUtils.formatDateTime(text) : '-',
    },
    {
      title: '标的',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
    },
    {
      title: '周期',
      dataIndex: 'freq',
      key: 'freq',
      width: 100,
    },
    {
      title: '信号名称',
      dataIndex: 'signal_name',
      key: 'signal_name',
      width: 150,
    },
    {
      title: '信号值',
      dataIndex: 'signal_value',
      key: 'signal_value',
      width: 120,
      render: (value: any) => {
        if (!value) return '-';
        const displayValue = String(value);
        const icon = signalMonitorUtils.getSignalIcon(displayValue);
        const color = signalMonitorUtils.getSignalColor(displayValue);
        return (
          <Space>
            <span style={{ fontSize: '1.2rem' }}>{icon}</span>
            <span style={{ color, fontWeight: 500 }}>{displayValue}</span>
          </Space>
        );
      },
    },
    {
      title: '信号数据',
      dataIndex: 'signal_data',
      key: 'signal_data',
      width: 300,
      render: (value: any) => {
        if (!value) return '-';
        if (typeof value === 'object') {
          const jsonStr = JSON.stringify(value);
          if (jsonStr.length > 100) {
            return jsonStr.substring(0, 100) + '...';
          }
          return jsonStr;
        }
        return String(value);
      },
    },
    {
      title: 'K线数',
      dataIndex: 'bars_count',
      key: 'bars_count',
      width: 100,
    },
    {
      title: '笔数',
      dataIndex: 'bi_count',
      key: 'bi_count',
      width: 100,
    },
  ];

  // 查询结果表格列定义
  const queryColumns: ColumnsType<SignalRecord> = [
    {
      title: '时间',
      dataIndex: 'signal_time',
      key: 'signal_time',
      width: 180,
      fixed: 'left',
      render: (text) => text ? signalMonitorUtils.formatDateTime(text) : '-',
    },
    {
      title: '标的',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
    },
    {
      title: '周期',
      dataIndex: 'freq',
      key: 'freq',
      width: 100,
    },
    {
      title: '信号名称',
      dataIndex: 'signal_name',
      key: 'signal_name',
      width: 150,
    },
    {
      title: '信号值',
      dataIndex: 'signal_value',
      key: 'signal_value',
      width: 120,
      render: (value: any) => {
        if (!value) return '-';
        const displayValue = String(value);
        const icon = signalMonitorUtils.getSignalIcon(displayValue);
        const color = signalMonitorUtils.getSignalColor(displayValue);
        return (
          <Space>
            <span style={{ fontSize: '1.2rem' }}>{icon}</span>
            <span style={{ color, fontWeight: 500 }}>{displayValue}</span>
          </Space>
        );
      },
    },
    {
      title: '信号数据',
      dataIndex: 'signal_data',
      key: 'signal_data',
      width: 300,
      render: (value: any) => {
        if (!value) return '-';
        if (typeof value === 'object') {
          const jsonStr = JSON.stringify(value);
          if (jsonStr.length > 100) {
            return jsonStr.substring(0, 100) + '...';
          }
          return jsonStr;
        }
        return String(value);
      },
    },
    {
      title: 'K线数',
      dataIndex: 'bars_count',
      key: 'bars_count',
      width: 100,
    },
    {
      title: '笔数',
      dataIndex: 'bi_count',
      key: 'bi_count',
      width: 100,
    },
  ];

  // 计算查询结果统计信息
  const queryStatistics = (() => {
    if (!querySignals || querySignals.length === 0) {
      return { buyCount: 0, sellCount: 0 };
    }

    const buyCount = querySignals.reduce((count, record) => {
      const signals = signalMonitorUtils.extractSignals(record);
      return count + signals.filter(s => signalMonitorUtils.isBuySignal(s.value)).length;
    }, 0);

    const sellCount = querySignals.reduce((count, record) => {
      const signals = signalMonitorUtils.extractSignals(record);
      return count + signals.filter(s => signalMonitorUtils.isSellSignal(s.value)).length;
    }, 0);

    return { buyCount, sellCount };
  })();

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="信号监控"
        subtitle="实时监控缠论交易信号，最新信号自动刷新"
        icon="📡"
      >
        <Button
          icon={<SyncOutlined spin={loading} />}
          onClick={handleRefresh}
          disabled={loading}
        >
          刷新
        </Button>
      </PageHeader>

      {/* 最新信号区域 */}
      <div className={styles.latestSection}>
        <Card
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#ef4444' }} />
              <span>最新信号</span>
              <Tag color="red">实时</Tag>
              <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#9ca3af' }}>
                每30秒自动刷新
              </span>
            </Space>
          }
        >
          <Table
            columns={latestColumns}
            dataSource={latestSignals}
            rowKey={(record, index) => `${record.dt}_${index}`}
            loading={false}
            pagination={false}
            scroll={{ x: 1200 }}
            size="small"
            rowClassName={(_record, index) => index === 0 ? styles.latestRow : ''}
          />
        </Card>
      </div>

      <Divider className={styles.divider}>历史查询</Divider>

      {/* 查询区域 */}
      <div className={styles.querySection}>
        <Card className={styles.queryCard} title="按币种周期查询">
          <Space wrap size="middle" className={styles.queryForm}>
            <div className={styles.formItem}>
              <span className={styles.label}>标的:</span>
              <Select
                style={{ width: 150 }}
                placeholder="选择标的"
                value={querySymbol}
                onChange={setQuerySymbol}
                options={[
                  { label: 'BTCUSDT', value: 'BTCUSDT' },
                  { label: 'ETHUSDT', value: 'ETHUSDT' },
                  { label: 'BNBUSDT', value: 'BNBUSDT' },
                ]}
              />
            </div>

            <div className={styles.formItem}>
              <span className={styles.label}>周期:</span>
              <Select
                style={{ width: 120 }}
                placeholder="选择周期"
                value={queryFreq}
                onChange={setQueryFreq}
                options={freqOptions}
              />
            </div>

            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleQuery}
              loading={loading}
            >
              查询
            </Button>
          </Space>

          {/* 查询结果统计 */}
          {summary && (
            <div className={styles.queryStats}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="总信号数"
                    value={summary.total_signals || 0}
                    prefix={<ThunderboltOutlined />}
                    valueStyle={{ fontSize: '1.25rem', color: '#3b82f6' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="买入信号"
                    value={queryStatistics.buyCount}
                    prefix={<RiseOutlined />}
                    valueStyle={{ fontSize: '1.25rem', color: '#10b981' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="卖出信号"
                    value={queryStatistics.sellCount}
                    prefix={<FallOutlined />}
                    valueStyle={{ fontSize: '1.25rem', color: '#ef4444' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="信号类型"
                    value={summary.signal_names?.length || 0}
                    prefix={<BarChartOutlined />}
                    valueStyle={{ fontSize: '1.25rem', color: '#8b5cf6' }}
                  />
                </Col>
              </Row>

              {summary.latest_signal_time && (
                <div className={styles.summaryInfo}>
                  <span className={styles.infoLabel}>最新信号时间：</span>
                  <span className={styles.infoValue}>
                    {signalMonitorUtils.formatDateTime(summary.latest_signal_time)}
                  </span>
                </div>
              )}

              {summary.signal_names && summary.signal_names.length > 0 && (
                <div className={styles.summaryInfo}>
                  <span className={styles.infoLabel}>有效信号列表：</span>
                  <Space wrap>
                    {summary.signal_names.map((name, index) => (
                      <Tag key={index} color="cyan">{name}</Tag>
                    ))}
                  </Space>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 查询结果表格 */}
        <div className={styles.tableContainer}>
          <Table
            columns={queryColumns}
            dataSource={querySignals}
            rowKey={(record, index) => `${record.dt}_${index}`}
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize,
              total: querySignals.length,
              onChange: (page) => setCurrentPage(page),
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1200 }}
          />
        </div>
      </div>
    </div>
  );
};

export default SignalMonitor;
