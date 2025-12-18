import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, Input, Spin, Empty, message } from 'antd';
import styles from './SignalMonitor.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { CoolRefreshButton } from '../components/ui';
import { breakoutAPI } from '../services/breakoutAPI';
import { boundaryAlertAPI } from '../services/boundaryAlertAPI';
import { BreakoutSignal, BoundaryAlert } from '../types';

interface SignalMonitorProps {
  isSidebarCollapsed?: boolean;
}

const SignalMonitor: React.FC<SignalMonitorProps> = ({ isSidebarCollapsed }) => {
  // 突破信号状态
  const [breakoutSignals, setBreakoutSignals] = useState<BreakoutSignal[]>([]);
  const [breakoutLoading, setBreakoutLoading] = useState(true);
  const [breakoutDirection, setBreakoutDirection] = useState<'all' | 'UP' | 'DOWN'>('all');
  const [breakoutSearch, setBreakoutSearch] = useState('');

  // 边界报警状态
  const [boundaryAlerts, setBoundaryAlerts] = useState<BoundaryAlert[]>([]);
  const [boundaryLoading, setBoundaryLoading] = useState(true);
  const [boundaryType, setBoundaryType] = useState<'all' | 'TOUCH_UPPER' | 'TOUCH_LOWER'>('all');
  const [boundarySearch, setBoundarySearch] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  // 获取突破信号
  const fetchBreakoutSignals = useCallback(async (showLoading = true) => {
    if (showLoading) setBreakoutLoading(true);
    try {
      const response = await breakoutAPI.getRecentSignals({ limit: 100 });
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
      setBreakoutSignals(signalsArray);
    } catch (error) {
      console.error('获取突破信号失败:', error);
    } finally {
      setBreakoutLoading(false);
    }
  }, []);

  // 获取边界报警
  const fetchBoundaryAlerts = useCallback(async (showLoading = true) => {
    if (showLoading) setBoundaryLoading(true);
    try {
      const response = await boundaryAlertAPI.getRecentAlerts({ limit: 100 });
      let alertsArray: BoundaryAlert[] = [];
      if (response) {
        if (Array.isArray(response)) {
          alertsArray = response;
        } else if ((response as any).alerts && Array.isArray((response as any).alerts)) {
          alertsArray = (response as any).alerts;
        } else if ((response as any).data?.alerts) {
          alertsArray = (response as any).data.alerts;
        }
      }
      setBoundaryAlerts(alertsArray);
    } catch (error) {
      console.error('获取边界报警失败:', error);
    } finally {
      setBoundaryLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    fetchBreakoutSignals();
    fetchBoundaryAlerts();
  }, [fetchBreakoutSignals, fetchBoundaryAlerts]);

  // 刷新
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchBreakoutSignals(false),
      fetchBoundaryAlerts(false)
    ]).finally(() => setRefreshing(false));
  }, [fetchBreakoutSignals, fetchBoundaryAlerts]);

  // 过滤突破信号
  const filteredBreakout = useMemo(() => {
    if (!Array.isArray(breakoutSignals)) return [];
    return breakoutSignals.filter(signal => {
      if (breakoutDirection !== 'all' && signal.direction !== breakoutDirection) return false;
      if (breakoutSearch && !signal.symbol.toLowerCase().includes(breakoutSearch.toLowerCase())) return false;
      return true;
    });
  }, [breakoutSignals, breakoutDirection, breakoutSearch]);

  // 过滤边界报警
  const filteredBoundary = useMemo(() => {
    if (!Array.isArray(boundaryAlerts)) return [];
    return boundaryAlerts.filter(alert => {
      if (boundaryType !== 'all' && alert.alert_type !== boundaryType) return false;
      if (boundarySearch && !alert.symbol.toLowerCase().includes(boundarySearch.toLowerCase())) return false;
      return true;
    });
  }, [boundaryAlerts, boundaryType, boundarySearch]);

  // 突破信号统计
  const breakoutStats = useMemo(() => {
    if (!Array.isArray(breakoutSignals) || breakoutSignals.length === 0) return null;
    return {
      total: breakoutSignals.length,
      up: breakoutSignals.filter(s => s.direction === 'UP').length,
      down: breakoutSignals.filter(s => s.direction === 'DOWN').length
    };
  }, [breakoutSignals]);

  // 边界报警统计
  const boundaryStats = useMemo(() => {
    if (!Array.isArray(boundaryAlerts) || boundaryAlerts.length === 0) return null;
    return {
      total: boundaryAlerts.length,
      upper: boundaryAlerts.filter(a => a.alert_type === 'TOUCH_UPPER').length,
      lower: boundaryAlerts.filter(a => a.alert_type === 'TOUCH_LOWER').length
    };
  }, [boundaryAlerts]);

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
    const baseSymbol = symbol.replace(/USDT$/i, '');
    return `https://cn.tradingview.com/chart/j4BQzamt/?symbol=BINANCE%3A${baseSymbol}USDT.P&interval=5`;
  };

  return (
    <div className={`${styles.signalMonitor} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="信号监控"
        subtitle="突破信号与边界报警实时监控"
        icon="📡"
      >
        <CoolRefreshButton
          onClick={handleRefresh}
          loading={refreshing}
          size="default"
        />
      </PageHeader>

      <div className={styles.dualPanel}>
        {/* 左侧：突破信号 */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>🚀 突破信号</h3>
            {breakoutStats && (
              <div className={styles.panelStats}>
                <span className={styles.statTotal}>{breakoutStats.total}</span>
                <span className={styles.statUp}>↑{breakoutStats.up}</span>
                <span className={styles.statDown}>↓{breakoutStats.down}</span>
              </div>
            )}
          </div>

          <div className={styles.panelFilters}>
            <Input
              placeholder="搜索币种..."
              value={breakoutSearch}
              onChange={(e) => setBreakoutSearch(e.target.value)}
              style={{ width: 120 }}
              size="small"
              allowClear
            />
            <Select
              value={breakoutDirection}
              onChange={setBreakoutDirection}
              style={{ width: 100 }}
              size="small"
              options={[
                { value: 'all', label: '全部' },
                { value: 'UP', label: '↑ 向上' },
                { value: 'DOWN', label: '↓ 向下' }
              ]}
            />
            <span className={styles.filterCount}>{filteredBreakout.length}条</span>
          </div>

          <div className={styles.panelList}>
            {breakoutLoading ? (
              <div className={styles.loadingContainer}>
                <Spin size="default" />
              </div>
            ) : filteredBreakout.length === 0 ? (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              filteredBreakout.map((signal) => (
                <a
                  key={signal.id}
                  href={getTradingViewUrl(signal.symbol)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.signalCard} ${signal.direction === 'UP' ? styles.up : styles.down}`}
                >
                  <div className={styles.cardRow}>
                    <span className={styles.symbol}>{signal.symbol}</span>
                    <span className={`${styles.direction} ${signal.direction === 'UP' ? styles.up : styles.down}`}>
                      {signal.direction === 'UP' ? '↑' : '↓'}
                    </span>
                    <span className={styles.price}>{formatPrice(signal.breakout_price)}</span>
                    <span className={styles.pct}>{signal.breakout_pct.toFixed(2)}%</span>
                    <span className={styles.zone}>
                      {formatPrice(signal.zone.lower_bound)}-{formatPrice(signal.zone.upper_bound)}
                    </span>
                    <span className={`${styles.score} ${signal.zone.zone_score >= 90 ? styles.scoreHigh : signal.zone.zone_score >= 80 ? styles.scoreMedium : ''}`}>
                      {signal.zone.zone_score}分
                    </span>
                    <span className={styles.time}>{formatTime(signal.signal_time)}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* 右侧：边界报警 */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>⚠️ 边界报警</h3>
            {boundaryStats && (
              <div className={styles.panelStats}>
                <span className={styles.statTotal}>{boundaryStats.total}</span>
                <span className={styles.statUp}>上{boundaryStats.upper}</span>
                <span className={styles.statDown}>下{boundaryStats.lower}</span>
              </div>
            )}
          </div>

          <div className={styles.panelFilters}>
            <Input
              placeholder="搜索币种..."
              value={boundarySearch}
              onChange={(e) => setBoundarySearch(e.target.value)}
              style={{ width: 120 }}
              size="small"
              allowClear
            />
            <Select
              value={boundaryType}
              onChange={setBoundaryType}
              style={{ width: 100 }}
              size="small"
              options={[
                { value: 'all', label: '全部' },
                { value: 'TOUCH_UPPER', label: '触上边界' },
                { value: 'TOUCH_LOWER', label: '触下边界' }
              ]}
            />
            <span className={styles.filterCount}>{filteredBoundary.length}条</span>
          </div>

          <div className={styles.panelList}>
            {boundaryLoading ? (
              <div className={styles.loadingContainer}>
                <Spin size="default" />
              </div>
            ) : filteredBoundary.length === 0 ? (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              filteredBoundary.map((alert) => (
                <a
                  key={alert.id}
                  href={getTradingViewUrl(alert.symbol)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.signalCard} ${alert.alert_type === 'TOUCH_UPPER' ? styles.up : styles.down}`}
                >
                  <div className={styles.cardRow}>
                    <span className={styles.symbol}>{alert.symbol}</span>
                    <span className={`${styles.direction} ${alert.alert_type === 'TOUCH_UPPER' ? styles.up : styles.down}`}>
                      {alert.alert_type === 'TOUCH_UPPER' ? '▲' : '▼'}
                    </span>
                    <span className={styles.price}>{formatPrice(alert.alert_price)}</span>
                    <span className={styles.zone}>
                      {formatPrice(alert.zone.lower_bound)}-{formatPrice(alert.zone.upper_bound)}
                    </span>
                    <span className={`${styles.score} ${alert.zone.zone_score >= 90 ? styles.scoreHigh : alert.zone.zone_score >= 80 ? styles.scoreMedium : ''}`}>
                      {alert.zone.zone_score}分
                    </span>
                    <span className={styles.time}>{formatTime(alert.alert_time)}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalMonitor;
