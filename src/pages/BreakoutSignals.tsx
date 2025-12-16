import React, { useState, useEffect, useCallback } from 'react';
import { Select, Input, Spin, Empty, message } from 'antd';
import styles from './BreakoutSignals.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { CoolRefreshButton } from '../components/ui';
import { breakoutAPI } from '../services/breakoutAPI';
import { BreakoutSignal, BreakoutStatistics } from '../types';

interface BreakoutSignalsProps {
  isSidebarCollapsed?: boolean;
}

const BreakoutSignals: React.FC<BreakoutSignalsProps> = ({ isSidebarCollapsed }) => {
  const [signals, setSignals] = useState<BreakoutSignal[]>([]);
  const [statistics, setStatistics] = useState<BreakoutStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'UP' | 'DOWN'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 获取数据
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      const [signalsData, statsData] = await Promise.all([
        breakoutAPI.getRecentSignals({ limit: 100 }),
        breakoutAPI.getStatistics({ hours: 24 })
      ]);

      // 处理signals数据 - 可能是数组或包含data属性的对象
      const signalsArray = Array.isArray(signalsData)
        ? signalsData
        : (signalsData as any)?.data || [];
      setSignals(signalsArray);

      // 处理statistics数据
      const stats = statsData && typeof statsData === 'object' && !Array.isArray(statsData)
        ? statsData
        : null;
      setStatistics(stats);
    } catch (error) {
      console.error('获取突破信号失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 刷新
  const handleRefresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  // 过滤数据 - 确保signals是数组
  const filteredSignals = Array.isArray(signals) ? signals.filter(signal => {
    // 方向过滤
    if (directionFilter !== 'all' && signal.direction !== directionFilter) {
      return false;
    }
    // 搜索过滤
    if (searchTerm && !signal.symbol.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  }) : [];

  // 格式化时间
  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 格式化价格
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  // 生成TradingView链接
  const getTradingViewUrl = (symbol: string) => {
    return `https://cn.tradingview.com/chart/j4BQzamt/?symbol=BINANCE%3A${symbol}USDT.P&interval=5`;
  };

  return (
    <div className={`${styles.breakoutSignals} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="突破信号"
        subtitle="实时监控价格区间突破信号"
        icon="🚀"
      >
        <CoolRefreshButton
          onClick={handleRefresh}
          loading={refreshing}
          size="default"
        />
      </PageHeader>

      {/* 统计卡片 */}
      {statistics && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.total_signals}</div>
            <div className={styles.statLabel}>24h总信号</div>
          </div>
          <div className={`${styles.statCard} ${styles.up}`}>
            <div className={styles.statValue}>{statistics.up_signals}</div>
            <div className={styles.statLabel}>向上突破</div>
          </div>
          <div className={`${styles.statCard} ${styles.down}`}>
            <div className={styles.statValue}>{statistics.down_signals}</div>
            <div className={styles.statLabel}>向下突破</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.symbols_count}</div>
            <div className={styles.statLabel}>涉及币种</div>
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className={styles.filters}>
        <Input
          placeholder="搜索币种..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          value={directionFilter}
          onChange={setDirectionFilter}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: '全部方向' },
            { value: 'UP', label: '📈 向上突破' },
            { value: 'DOWN', label: '📉 向下突破' }
          ]}
        />
        <span className={styles.resultCount}>
          共 {filteredSignals.length} 条信号
        </span>
      </div>

      {/* 信号列表 */}
      <div className={styles.signalList}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" />
            <p>加载中...</p>
          </div>
        ) : filteredSignals.length === 0 ? (
          <Empty description="暂无突破信号" />
        ) : (
          filteredSignals.map((signal) => (
            <a
              key={signal.id}
              href={getTradingViewUrl(signal.symbol)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.signalCard} ${signal.direction === 'UP' ? styles.up : styles.down}`}
            >
              <div className={styles.signalHeader}>
                <div className={styles.symbolInfo}>
                  <span className={styles.symbol}>{signal.symbol}</span>
                  <span className={`${styles.direction} ${signal.direction === 'UP' ? styles.up : styles.down}`}>
                    {signal.direction === 'UP' ? '📈 向上突破' : '📉 向下突破'}
                  </span>
                </div>
                <div className={styles.time}>{formatTime(signal.breakout_time)}</div>
              </div>

              <div className={styles.signalBody}>
                <div className={styles.priceInfo}>
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>突破价格</span>
                    <span className={styles.priceValue}>{formatPrice(signal.breakout_price)}</span>
                  </div>
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>区间高点</span>
                    <span className={styles.priceValue}>{formatPrice(signal.range_high)}</span>
                  </div>
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>区间低点</span>
                    <span className={styles.priceValue}>{formatPrice(signal.range_low)}</span>
                  </div>
                </div>

                {(signal.volume_ratio || signal.oi_change_percent || signal.signal_strength) && (
                  <div className={styles.extraInfo}>
                    {signal.volume_ratio && (
                      <span className={styles.tag}>成交量比: {signal.volume_ratio.toFixed(2)}x</span>
                    )}
                    {signal.oi_change_percent && (
                      <span className={styles.tag}>OI变化: {signal.oi_change_percent.toFixed(2)}%</span>
                    )}
                    {signal.signal_strength && (
                      <span className={styles.tag}>强度: {signal.signal_strength.toFixed(1)}</span>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.signalFooter}>
                <span className={styles.rangeTime}>
                  区间: {formatTime(signal.range_start_time)} - {formatTime(signal.range_end_time)}
                </span>
                <span className={styles.clickHint}>点击查看图表 →</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

export default BreakoutSignals;
