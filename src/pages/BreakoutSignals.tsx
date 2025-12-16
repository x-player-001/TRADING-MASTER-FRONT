import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, Input, Spin, Empty, message } from 'antd';
import styles from './BreakoutSignals.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { CoolRefreshButton } from '../components/ui';
import { breakoutAPI } from '../services/breakoutAPI';
import { BreakoutSignal } from '../types';

interface BreakoutSignalsProps {
  isSidebarCollapsed?: boolean;
}

const BreakoutSignals: React.FC<BreakoutSignalsProps> = ({ isSidebarCollapsed }) => {
  const [signals, setSignals] = useState<BreakoutSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'UP' | 'DOWN'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 获取数据
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      const response = await breakoutAPI.getRecentSignals({ limit: 100 });

      // 处理signals数据 - API返回 { count, signals } 格式
      let signalsArray: BreakoutSignal[] = [];
      if (response) {
        if (Array.isArray(response)) {
          signalsArray = response;
        } else if ((response as any).signals && Array.isArray((response as any).signals)) {
          signalsArray = (response as any).signals;
        } else if ((response as any).data?.signals) {
          signalsArray = (response as any).data.signals;
        }
      }
      setSignals(signalsArray);
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
  const filteredSignals = useMemo(() => {
    if (!Array.isArray(signals)) return [];
    return signals.filter(signal => {
      // 方向过滤
      if (directionFilter !== 'all' && signal.direction !== directionFilter) {
        return false;
      }
      // 搜索过滤
      if (searchTerm && !signal.symbol.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [signals, directionFilter, searchTerm]);

  // 统计数据 - 从signals计算
  const statistics = useMemo(() => {
    if (!Array.isArray(signals) || signals.length === 0) return null;
    const upCount = signals.filter(s => s.direction === 'UP').length;
    const downCount = signals.filter(s => s.direction === 'DOWN').length;
    const uniqueSymbols = new Set(signals.map(s => s.symbol)).size;
    return {
      total: signals.length,
      up: upCount,
      down: downCount,
      symbols: uniqueSymbols
    };
  }, [signals]);

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
    // 去掉USDT后缀（如果有）再拼接
    const baseSymbol = symbol.replace(/USDT$/i, '');
    return `https://cn.tradingview.com/chart/j4BQzamt/?symbol=BINANCE%3A${baseSymbol}USDT.P&interval=5`;
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
            <div className={styles.statValue}>{statistics.total}</div>
            <div className={styles.statLabel}>总信号</div>
          </div>
          <div className={`${styles.statCard} ${styles.up}`}>
            <div className={styles.statValue}>{statistics.up}</div>
            <div className={styles.statLabel}>向上突破</div>
          </div>
          <div className={`${styles.statCard} ${styles.down}`}>
            <div className={styles.statValue}>{statistics.down}</div>
            <div className={styles.statLabel}>向下突破</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.symbols}</div>
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
              <div className={styles.signalRow}>
                <span className={styles.symbol}>{signal.symbol}</span>
                <span className={`${styles.direction} ${signal.direction === 'UP' ? styles.up : styles.down}`}>
                  {signal.direction === 'UP' ? '↑' : '↓'}
                </span>
                <span className={styles.price}>{formatPrice(signal.breakout_price)}</span>
                <span className={styles.pct}>{signal.breakout_pct.toFixed(2)}%</span>
                <span className={styles.volume}>{signal.volume_ratio.toFixed(1)}x</span>
                <span className={styles.time}>{formatTime(signal.signal_time)}</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

export default BreakoutSignals;
