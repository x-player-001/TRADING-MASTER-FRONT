import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, Input, Spin, Empty, message } from 'antd';
import styles from './SRMonitor.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { CoolRefreshButton } from '../components/ui';
import { srAPI } from '../services/srAPI';
import { SRAlert } from '../types';

interface SRMonitorProps {
  isSidebarCollapsed?: boolean;
}

const SRMonitor: React.FC<SRMonitorProps> = ({ isSidebarCollapsed }) => {
  const [alerts, setAlerts] = useState<SRAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 筛选条件
  const [alertTypeFilter, setAlertTypeFilter] = useState<'all' | 'SQUEEZE' | 'APPROACHING' | 'TOUCHED'>('all');
  const [levelTypeFilter, setLevelTypeFilter] = useState<'all' | 'SUPPORT' | 'RESISTANCE'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [descSearch, setDescSearch] = useState('');

  // 获取数据
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      const params: any = { limit: 100 };
      if (alertTypeFilter !== 'all') params.alert_type = alertTypeFilter;
      if (levelTypeFilter !== 'all') params.level_type = levelTypeFilter;

      const response = await srAPI.getRecentAlerts(params);

      let alertsArray: SRAlert[] = [];
      if (response) {
        if (Array.isArray(response)) {
          alertsArray = response;
        } else if ((response as any).alerts && Array.isArray((response as any).alerts)) {
          alertsArray = (response as any).alerts;
        } else if ((response as any).data?.alerts) {
          alertsArray = (response as any).data.alerts;
        }
      }
      setAlerts(alertsArray);
    } catch (error) {
      console.error('获取支撑阻力位报警失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [alertTypeFilter, levelTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 刷新
  const handleRefresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  // 过滤数据（搜索）
  const filteredAlerts = useMemo(() => {
    if (!Array.isArray(alerts)) return [];
    return alerts.filter(alert => {
      if (searchTerm && !alert.symbol.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (descSearch && !alert.description.toLowerCase().includes(descSearch.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [alerts, searchTerm, descSearch]);

  // 统计数据
  const statistics = useMemo(() => {
    if (!Array.isArray(alerts) || alerts.length === 0) return null;
    const squeezeCount = alerts.filter(a => a.alert_type === 'SQUEEZE').length;
    const approachingCount = alerts.filter(a => a.alert_type === 'APPROACHING').length;
    const touchedCount = alerts.filter(a => a.alert_type === 'TOUCHED').length;
    const supportCount = alerts.filter(a => a.level_type === 'SUPPORT').length;
    const resistanceCount = alerts.filter(a => a.level_type === 'RESISTANCE').length;
    const uniqueSymbols = new Set(alerts.map(a => a.symbol)).size;
    return {
      total: alerts.length,
      squeeze: squeezeCount,
      approaching: approachingCount,
      touched: touchedCount,
      support: supportCount,
      resistance: resistanceCount,
      symbols: uniqueSymbols
    };
  }, [alerts]);

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
  const getTradingViewUrl = (symbol: string, interval: string) => {
    const baseSymbol = symbol.replace(/USDT$/i, '');
    // 转换interval格式
    let tvInterval = '5';
    if (interval === '1m') tvInterval = '1';
    else if (interval === '5m') tvInterval = '5';
    else if (interval === '15m') tvInterval = '15';
    else if (interval === '30m') tvInterval = '30';
    else if (interval === '1h') tvInterval = '60';
    else if (interval === '4h') tvInterval = '240';
    else if (interval === '1d') tvInterval = 'D';
    return `https://cn.tradingview.com/chart/j4BQzamt/?symbol=BINANCE%3A${baseSymbol}USDT.P&interval=${tvInterval}`;
  };

  // 获取报警类型显示
  const getAlertTypeDisplay = (alertType: string) => {
    switch (alertType) {
      case 'SQUEEZE': return '收敛';
      case 'APPROACHING': return '接近';
      case 'TOUCHED': return '触及';
      default: return alertType;
    }
  };

  // 获取报警类型样式
  const getAlertTypeClass = (alertType: string) => {
    switch (alertType) {
      case 'SQUEEZE': return styles.squeeze;
      case 'APPROACHING': return styles.approaching;
      case 'TOUCHED': return styles.touched;
      default: return '';
    }
  };

  return (
    <div className={`${styles.srMonitor} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="支撑阻力位监控"
        subtitle="实时监控价格接近或触及支撑阻力位的报警信号"
        icon="📍"
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
            <div className={styles.statLabel}>总报警</div>
          </div>
          <div className={`${styles.statCard} ${styles.squeeze}`}>
            <div className={styles.statValue}>{statistics.squeeze}</div>
            <div className={styles.statLabel}>波动收敛</div>
          </div>
          <div className={`${styles.statCard} ${styles.approaching}`}>
            <div className={styles.statValue}>{statistics.approaching}</div>
            <div className={styles.statLabel}>接近中</div>
          </div>
          <div className={`${styles.statCard} ${styles.touched}`}>
            <div className={styles.statValue}>{statistics.touched}</div>
            <div className={styles.statLabel}>已触及</div>
          </div>
          <div className={`${styles.statCard} ${styles.support}`}>
            <div className={styles.statValue}>{statistics.support}</div>
            <div className={styles.statLabel}>支撑位</div>
          </div>
          <div className={`${styles.statCard} ${styles.resistance}`}>
            <div className={styles.statValue}>{statistics.resistance}</div>
            <div className={styles.statLabel}>阻力位</div>
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className={styles.filters}>
        <Input
          placeholder="搜索币种..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 120 }}
          allowClear
        />
        <Input
          placeholder="搜索特征描述..."
          value={descSearch}
          onChange={(e) => setDescSearch(e.target.value)}
          style={{ width: 160 }}
          allowClear
        />
        <Select
          value={alertTypeFilter}
          onChange={setAlertTypeFilter}
          style={{ width: 130 }}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'SQUEEZE', label: '🔄 波动收敛' },
            { value: 'APPROACHING', label: '🔔 接近中' },
            { value: 'TOUCHED', label: '🎯 已触及' }
          ]}
        />
        <Select
          value={levelTypeFilter}
          onChange={setLevelTypeFilter}
          style={{ width: 120 }}
          options={[
            { value: 'all', label: '全部价位' },
            { value: 'SUPPORT', label: '📗 支撑位' },
            { value: 'RESISTANCE', label: '📕 阻力位' }
          ]}
        />
        <span className={styles.resultCount}>
          共 {filteredAlerts.length} 条报警
        </span>
      </div>

      {/* 报警列表 */}
      <div className={styles.alertList}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" />
            <p>加载中...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <Empty description="暂无报警信号" />
        ) : (
          filteredAlerts.map((alert) => (
            <a
              key={alert.id}
              href={getTradingViewUrl(alert.symbol, alert.interval)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.alertCard} ${alert.level_type === 'SUPPORT' ? styles.support : styles.resistance}`}
            >
              <div className={styles.alertRow}>
                <span className={styles.symbol}>{alert.symbol}</span>
                <span className={styles.interval}>{alert.interval}</span>
                <span className={`${styles.levelType} ${alert.level_type === 'SUPPORT' ? styles.support : styles.resistance}`}>
                  {alert.level_type === 'SUPPORT' ? '支撑' : '阻力'}
                </span>
                <span className={`${styles.alertType} ${getAlertTypeClass(alert.alert_type)}`}>
                  {getAlertTypeDisplay(alert.alert_type)}
                </span>
                <span className={styles.price}>
                  {formatPrice(alert.current_price)} → {formatPrice(alert.level_price)}
                </span>
                <span className={styles.distance}>
                  {alert.distance_pct.toFixed(2)}%
                </span>
                <span className={styles.strength}>
                  强度{alert.level_strength}
                </span>
                <span className={styles.description} title={alert.description}>
                  {alert.description.split('|')[1]?.trim() || ''}
                </span>
                <span className={styles.time}>{formatTime(alert.kline_time_str)}</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

export default SRMonitor;
