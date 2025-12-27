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

// 按币种分组的数据结构
interface SymbolGroup {
  symbol: string;
  alert_count: number;
  latest_alert_time: string;
  alert_types: Record<string, number>;
  alerts: SRAlert[];
}

interface GroupedResponse {
  symbol_count: number;
  total_alerts: number;
  symbols: Record<string, SymbolGroup>;
}

const SRMonitor: React.FC<SRMonitorProps> = ({ isSidebarCollapsed }) => {
  const [groupedData, setGroupedData] = useState<GroupedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  // 筛选条件（前端筛选）
  const [alertTypeFilter, setAlertTypeFilter] = useState<'all' | 'SQUEEZE' | 'APPROACHING' | 'TOUCHED' | 'BULLISH_STREAK' | 'PULLBACK_READY'>('all');
  const [levelTypeFilter, setLevelTypeFilter] = useState<'all' | 'SUPPORT' | 'RESISTANCE'>('all');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');

  // 获取数据（只传limit和group_by）
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      const params: any = { limit: 500, group_by: 'symbol' };
      const response = await srAPI.getRecentAlerts(params);

      // 解析分组响应
      if (response && (response as any).symbols) {
        setGroupedData(response as unknown as GroupedResponse);
      } else if (response && (response as any).data?.symbols) {
        setGroupedData((response as any).data as GroupedResponse);
      } else {
        setGroupedData(null);
      }
    } catch (error) {
      console.error('获取支撑阻力位报警失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 刷新
  const handleRefresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  // 切换展开/折叠
  const toggleExpand = (symbol: string) => {
    setExpandedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  // 前端筛选后的分组数据
  const filteredGroups = useMemo(() => {
    if (!groupedData) return [];

    return Object.values(groupedData.symbols)
      .map(group => {
        // 筛选币种名称
        if (symbolSearch && !group.symbol.toLowerCase().includes(symbolSearch.toLowerCase())) {
          return null;
        }

        // 筛选alerts
        const filteredAlerts = group.alerts.filter(alert => {
          // 类型筛选
          if (alertTypeFilter !== 'all' && alert.alert_type !== alertTypeFilter) {
            return false;
          }
          // 价位筛选
          if (levelTypeFilter !== 'all' && alert.level_type !== levelTypeFilter) {
            return false;
          }
          // 描述关键字筛选
          if (keywordSearch && !alert.description.toLowerCase().includes(keywordSearch.toLowerCase())) {
            return false;
          }
          return true;
        });

        // 如果没有符合条件的alerts，跳过这个分组
        if (filteredAlerts.length === 0) {
          return null;
        }

        // 重新计算类型统计
        const alertTypes: Record<string, number> = {};
        filteredAlerts.forEach(alert => {
          alertTypes[alert.alert_type] = (alertTypes[alert.alert_type] || 0) + 1;
        });

        return {
          ...group,
          alerts: filteredAlerts,
          alert_count: filteredAlerts.length,
          alert_types: alertTypes,
          latest_alert_time: filteredAlerts[0]?.kline_time_str || group.latest_alert_time
        };
      })
      .filter((g): g is SymbolGroup => g !== null)
      .sort((a, b) => new Date(b.latest_alert_time).getTime() - new Date(a.latest_alert_time).getTime());
  }, [groupedData, symbolSearch, keywordSearch, alertTypeFilter, levelTypeFilter]);

  // 统计数据（基于筛选后的数据）
  const statistics = useMemo(() => {
    if (filteredGroups.length === 0) return null;

    let squeezeCount = 0;
    let approachingCount = 0;
    let touchedCount = 0;
    let bullishStreakCount = 0;
    let pullbackReadyCount = 0;
    let supportCount = 0;
    let resistanceCount = 0;
    let totalAlerts = 0;

    filteredGroups.forEach(group => {
      totalAlerts += group.alert_count;
      group.alerts.forEach(alert => {
        if (alert.alert_type === 'SQUEEZE') squeezeCount++;
        if (alert.alert_type === 'APPROACHING') approachingCount++;
        if (alert.alert_type === 'TOUCHED') touchedCount++;
        if (alert.alert_type === 'BULLISH_STREAK') bullishStreakCount++;
        if (alert.alert_type === 'PULLBACK_READY') pullbackReadyCount++;
        if (alert.level_type === 'SUPPORT') supportCount++;
        if (alert.level_type === 'RESISTANCE') resistanceCount++;
      });
    });

    return {
      total: totalAlerts,
      symbols: filteredGroups.length,
      squeeze: squeezeCount,
      approaching: approachingCount,
      touched: touchedCount,
      bullishStreak: bullishStreakCount,
      pullbackReady: pullbackReadyCount,
      support: supportCount,
      resistance: resistanceCount
    };
  }, [filteredGroups]);

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
  const getTradingViewUrl = (symbol: string, interval: string = '5m') => {
    const baseSymbol = symbol.replace(/USDT$/i, '');
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
      case 'BULLISH_STREAK': return '连涨';
      case 'PULLBACK_READY': return '回调';
      default: return alertType;
    }
  };

  // 获取报警类型样式
  const getAlertTypeClass = (alertType: string) => {
    switch (alertType) {
      case 'SQUEEZE': return styles.squeeze;
      case 'APPROACHING': return styles.approaching;
      case 'TOUCHED': return styles.touched;
      case 'BULLISH_STREAK': return styles.bullishStreak;
      case 'PULLBACK_READY': return styles.pullbackReady;
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
          <div className={`${styles.statCard} ${styles.bullishStreak}`}>
            <div className={styles.statValue}>{statistics.bullishStreak}</div>
            <div className={styles.statLabel}>连涨</div>
          </div>
          <div className={`${styles.statCard} ${styles.pullbackReady}`}>
            <div className={styles.statValue}>{statistics.pullbackReady}</div>
            <div className={styles.statLabel}>回调待发</div>
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
          value={symbolSearch}
          onChange={(e) => setSymbolSearch(e.target.value)}
          style={{ width: 120 }}
          allowClear
        />
        <Input
          placeholder="搜索描述(如:粘合)..."
          value={keywordSearch}
          onChange={(e) => setKeywordSearch(e.target.value)}
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
            { value: 'TOUCHED', label: '🎯 已触及' },
            { value: 'BULLISH_STREAK', label: '🚀 连涨' },
            { value: 'PULLBACK_READY', label: '📉 回调待发' }
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
          {statistics ? `${statistics.symbols} 个币种，${statistics.total} 条报警` : '加载中...'}
        </span>
      </div>

      {/* 报警列表 - 按币种分组 */}
      <div className={styles.alertList}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" />
            <p>加载中...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <Empty description="暂无报警信号" />
        ) : (
          filteredGroups.map((group) => (
            <div key={group.symbol} className={styles.symbolGroup}>
              {/* 币种头部 */}
              <div
                className={styles.symbolHeader}
                onClick={() => toggleExpand(group.symbol)}
              >
                <span className={styles.expandIcon}>
                  {expandedSymbols.has(group.symbol) ? '▼' : '▶'}
                </span>
                <a
                  href={getTradingViewUrl(group.symbol)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.symbolName}
                  onClick={(e) => e.stopPropagation()}
                >
                  {group.symbol}
                </a>
                <span className={styles.alertCount}>{group.alert_count}条</span>
                <div className={styles.alertTypeTags}>
                  {Object.entries(group.alert_types).map(([type, count]) => (
                    <span
                      key={type}
                      className={`${styles.typeTag} ${getAlertTypeClass(type)}`}
                    >
                      {getAlertTypeDisplay(type)} {count}
                    </span>
                  ))}
                </div>
                <span className={styles.latestTime}>
                  最新: {formatTime(group.latest_alert_time)}
                </span>
              </div>

              {/* 展开的报警详情 */}
              {expandedSymbols.has(group.symbol) && (
                <div className={styles.alertDetails}>
                  {group.alerts.map((alert) => (
                    <a
                      key={alert.id}
                      href={getTradingViewUrl(alert.symbol, alert.interval)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.alertCard} ${alert.level_type === 'SUPPORT' ? styles.support : styles.resistance}`}
                    >
                      <div className={styles.alertRow}>
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
                          {alert.description}
                        </span>
                        <span className={styles.time}>{formatTime(alert.kline_time_str)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SRMonitor;
