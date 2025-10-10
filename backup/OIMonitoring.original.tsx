import React, { useState, useEffect, useMemo } from 'react';
import { DatePicker, Input } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import styles from './OIMonitoring.module.scss';
import {
  OIStatisticsResponse,
  OIAnomaliesResponse,
  OIServiceStatusData
} from '../types';
import { oiAPI } from '../services/oiAPI';
import PageHeader from '../components/ui/PageHeader';
import { StatusOverview, StatusCardProps, StatusIndicator } from '../components/ui';

interface OIMonitoringProps {
  isSidebarCollapsed: boolean;
}

const OIMonitoring: React.FC<OIMonitoringProps> = ({ isSidebarCollapsed }) => {
  const [statistics, setStatistics] = useState<OIStatisticsResponse | null>(null);
  const [anomalies, setAnomalies] = useState<OIAnomaliesResponse | null>(null);
  const [serviceStatus, setServiceStatus] = useState<OIServiceStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 筛选状态
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatUptime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // 生成状态卡片数据
  const getStatusCards = (): StatusCardProps[] => {
    const cards: StatusCardProps[] = [];

    // 服务运行状态
    cards.push({
      icon: <StatusIndicator status={serviceStatus?.is_running ? 'running' : 'stopped'} />,
      label: 'OI服务状态',
      value: serviceStatus?.is_running ? '运行中' : '已停止',
      status: serviceStatus?.is_running ? 'running' : 'stopped',
      glowColor: serviceStatus?.is_running ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
      index: 0
    });

    // 监控币种数量
    cards.push({
      icon: '🎯',
      label: '监控币种',
      value: serviceStatus?.active_symbols_count || 0,
      glowColor: 'rgba(245, 158, 11, 0.6)', // 橙色流光
      index: 1
    });

    // 轮询间隔
    cards.push({
      icon: '⏱️',
      label: '轮询间隔',
      value: serviceStatus?.config?.polling_interval_ms ? `${serviceStatus.config.polling_interval_ms / 1000}s` : '30s',
      glowColor: 'rgba(139, 92, 246, 0.6)', // 紫色流光
      index: 2
    });

    // 服务运行时间
    if (serviceStatus?.uptime_ms) {
      cards.push({
        icon: '📈',
        label: '运行时间',
        value: formatUptime(serviceStatus.uptime_ms),
        glowColor: 'rgba(34, 197, 94, 0.6)', // 绿色流光
        index: 3
      });
    }

    // 最后轮询时间
    if (serviceStatus?.last_poll_time) {
      cards.push({
        icon: '🕐',
        label: '最后轮询',
        value: new Date(serviceStatus.last_poll_time).toLocaleString(),
        glowColor: 'rgba(168, 85, 247, 0.6)', // 紫罗兰色流光
        index: 4
      });
    }

    return cards;
  };



  // 获取数据的函数需要移到useEffect外部供其他函数调用
  const fetchData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      // 准备API参数
      const apiParams = selectedDate ? { date: selectedDate.format('YYYY-MM-DD') } : {};

      // 并行请求OI相关API接口
      const [statisticsData, anomaliesData, statusData] = await Promise.all([
        oiAPI.getOIStatistics(apiParams),
        oiAPI.getRecentAnomalies(apiParams),
        oiAPI.getOIServiceStatus().catch((err) => {
          console.warn('OI服务状态获取失败:', err);
          return null;
        })
      ]);

      // apiClient已经自动解包了data，直接使用响应数据
      setStatistics(statisticsData);
      setAnomalies(anomaliesData);
      setServiceStatus(statusData);
    } catch (err) {
      console.error('API请求失败:', err);

      // 仅在初始加载时显示错误
      if (isInitialLoad) {
        setError(`获取数据失败: ${err instanceof Error ? err.message : '未知错误'}`);
        setStatistics(null);
        setAnomalies(null);
      } else {
        // 静默处理后台刷新错误，保持当前数据
        console.warn('后台数据刷新失败，保持当前数据');
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };


  // 根据筛选条件过滤统计数据
  const filteredStatistics = useMemo(() => {
    if (!statistics || !Array.isArray(statistics)) return [];

    if (!searchTerm.trim()) return statistics;

    const term = searchTerm.toLowerCase().trim();
    return statistics.filter(stat =>
      stat.symbol.toLowerCase().includes(term)
    );
  }, [statistics, searchTerm]);

  // 根据筛选条件过滤异常数据
  const filteredAnomalies = useMemo(() => {
    if (!anomalies || !Array.isArray(anomalies)) return [];

    if (!searchTerm.trim()) return anomalies;

    const term = searchTerm.toLowerCase().trim();
    return anomalies.filter(anomaly =>
      anomaly.symbol.toLowerCase().includes(term)
    );
  }, [anomalies, searchTerm]);

  // 真实API数据加载
  useEffect(() => {
    // 初始加载
    fetchData(true);

    // 设置定时刷新（后台静默更新）- 5分钟
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDate]); // 依赖selectedDate，当日期改变时重新获取数据

  if (loading) {
    return (
      <div className={`${styles.oiMonitoring} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.loading}>
          <div>
            <div className={styles.spinner}></div>
            <div className={styles.text}>加载中...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.oiMonitoring} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.error}>
          <div className={styles.content}>
            <div className={styles.icon}>⚠️</div>
            <div className={styles.text}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.oiMonitoring} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      {/* 页面标题 */}
      <PageHeader
        title="OI监控中心"
        subtitle="实时监控开放权益数据，异常检测与预警"
        icon="📊"
      >
        {isRefreshing && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            刷新中...
          </div>
        )}
      </PageHeader>

      {/* 筛选器 */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>日期筛选：</label>
            <DatePicker
              placeholder="选择日期"
              value={selectedDate}
              onChange={setSelectedDate}
              allowClear
              format="YYYY-MM-DD"
              style={{ width: 200 }}
            />
            {selectedDate && (
              <span className={styles.filterTip}>
                查看 {selectedDate.format('YYYY-MM-DD')} 的数据
              </span>
            )}
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>代币搜索：</label>
            <Input.Search
              placeholder="输入代币名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 250 }}
              enterButton={false}
            />
            {searchTerm && (
              <span className={styles.filterTip}>
                搜索包含 "{searchTerm}" 的代币
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 服务状态概览 */}
      <StatusOverview cards={getStatusCards()} />

      <div className={styles.mainGrid}>
        {/* OI统计数据 */}
        {statistics && Array.isArray(statistics) && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2>OI统计数据</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {searchTerm
                      ? `找到 ${filteredStatistics.length} 个匹配币种`
                      : `显示前 30 个币种`
                    }
                  </span>
                  <button
                    onClick={() => fetchData(false)}
                    style={{
                      padding: '0.5rem',
                      fontSize: '1rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      color: '#6b7280',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#3b82f6'}
                    onMouseLeave={(e) => e.target.style.color = '#6b7280'}
                    title="刷新数据"
                  >
                    🔄
                  </button>
                </div>
              </div>
              <p>
                {searchTerm
                  ? `原始数据：${statistics.length} 个币种，筛选后：${filteredStatistics.length} 个币种`
                  : `共 ${statistics.length} 个币种正在监控`
                }
                {selectedDate && (
                  <span style={{ marginLeft: '1rem', color: '#6b7280' }}>
                    （查询日期：{selectedDate.format('YYYY-MM-DD')}）
                  </span>
                )}
              </p>
            </div>
            <div className={styles.cardContent}>
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
                    {filteredStatistics
                      .slice(0, 30)
                      .map((stat, index) => (
                        <tr key={stat.symbol} className={styles.tableRow}>
                          <td className={styles.symbolCell}>
                            <span className={styles.symbolName}>{stat.symbol}</span>
                          </td>
                          <td className={styles.changeCell}>
                            <span className={`${styles.changeValue} ${parseFloat(stat.daily_change_pct) >= 0 ? styles.positive : styles.negative}`}>
                              {parseFloat(stat.daily_change_pct) >= 0 ? '+' : ''}{parseFloat(stat.daily_change_pct).toFixed(2)}%
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
                                {new Date(stat.first_anomaly_time).toLocaleString()}
                              </span>
                            ) : (
                              <span className={styles.noData}>-</span>
                            )}
                          </td>
                          <td className={styles.timeCell}>
                            {stat.last_anomaly_time ? (
                              <span className={styles.timeValue}>
                                {new Date(stat.last_anomaly_time).toLocaleString()}
                              </span>
                            ) : (
                              <span className={styles.noData}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 异常监测 */}
        {anomalies && Array.isArray(anomalies) && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2>异常监测</h2>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedDate ? selectedDate.format('YYYY-MM-DD') : '最近24小时'}
                </span>
              </div>
              <p>
                {searchTerm
                  ? `原始异常：${anomalies.length} 个，筛选后：${filteredAnomalies.length} 个`
                  : `共发现 ${anomalies.length} 个异常`
                }
              </p>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.anomalyList}>
                {filteredAnomalies.length > 0 ? (
                  filteredAnomalies.slice(0, 30).map((anomaly, index) => (
                    <div
                      key={`${anomaly.symbol}-${anomaly.anomaly_time}-${index}`}
                      className={`${styles.anomalyItem} ${styles[anomaly.severity] || styles.medium}`}
                    >
                      <div className={styles.anomalyHeader}>
                        <div className={styles.anomalyInfo}>
                          <span className={styles.symbol}>{anomaly.symbol}</span>
                          <span className={styles.type}>
                            {anomaly.period_minutes}分钟异常
                          </span>
                        </div>
                        <span className={styles.timestamp}>
                          {new Date(anomaly.anomaly_time).toLocaleString()}
                        </span>
                      </div>
                      <p className={styles.message}>
                        OI在{anomaly.period_minutes}分钟内变化
                        <span className={`${styles.changeText} ${anomaly.percent_change > 0 ? styles.increase : styles.decrease}`}>
                          {anomaly.percent_change > 0 ? '增长' : '下降'} {Math.abs(anomaly.percent_change).toFixed(2)}%
                        </span>
                        <span className={styles.detailText}>
                          （${formatNumber(parseFloat(anomaly.oi_before))} → ${formatNumber(parseFloat(anomaly.oi_after))}，变化量 ${formatNumber(parseFloat(anomaly.oi_change))}）
                        </span>
                      </p>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.icon}>✅</div>
                    <p className={styles.text}>暂无异常检测</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default OIMonitoring;