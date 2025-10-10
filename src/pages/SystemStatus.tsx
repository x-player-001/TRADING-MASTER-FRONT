import React, { useState, useEffect } from 'react';
import styles from './SystemStatus.module.scss';
import {
  SystemHealthResponse,
  SystemMetrics,
  AlertsResponse,
  SystemStats,
  HealthCheck,
  Alert
} from '../types';
import { monitoringAPI } from '../services/monitoringAPI';
import PageHeader from '../components/ui/PageHeader';
import { StatusOverview, StatusCardProps, StatusIndicator } from '../components/ui';

const SystemStatus: React.FC = () => {
  const [healthData, setHealthData] = useState<SystemHealthResponse | null>(null);
  const [metricsData, setMetricsData] = useState<SystemMetrics | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsResponse | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [statsSummary, setStatsSummary] = useState<any>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'logs'>('overview');

  const formatUptime = (ms: number | undefined): string => {
    if (ms === undefined || ms === null || isNaN(ms)) {
      return '0m';
    }

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number | undefined): string => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) {
      return '0B';
    }
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + 'GB';
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + 'MB';
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + 'KB';
    return bytes.toFixed(0) + 'B';
  };

  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0.0%';
    }
    return value.toFixed(1) + '%';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return styles.healthy;
      case 'warning': return styles.warning;
      case 'unhealthy': return styles.unhealthy;
      default: return styles.unknown;
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return styles.critical;
      case 'warning': return styles.warningAlert;
      case 'info': return styles.info;
      default: return styles.info;
    }
  };

  // 生成状态卡片数据
  const getStatusCards = (): StatusCardProps[] => {
    const cards: StatusCardProps[] = [];

    // 系统状态
    if (healthData) {
      cards.push({
        icon: <StatusIndicator status={healthData.overall_status as any} />,
        label: '系统状态',
        value: healthData.overall_status === 'healthy' ? '正常' :
               healthData.overall_status === 'warning' ? '警告' : '异常',
        status: healthData.overall_status as any,
        glowColor: healthData.overall_status === 'healthy' ? 'rgba(16, 185, 129, 0.6)' :
                   healthData.overall_status === 'warning' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)',
        index: 0
      });
    }

    // 内存使用率
    if (metricsData && metricsData.memory) {
      cards.push({
        icon: '💾',
        label: '内存使用率',
        value: formatPercentage(metricsData.memory.usage_percentage),
        status: (metricsData.memory.usage_percentage || 0) > 80 ? 'warning' : 'healthy',
        glowColor: 'rgba(139, 92, 246, 0.6)',
        index: 1
      });
    }

    // CPU使用率
    if (metricsData && metricsData.cpu) {
      cards.push({
        icon: '🔧',
        label: 'CPU使用率',
        value: formatPercentage(metricsData.cpu.usage_percentage),
        status: (metricsData.cpu.usage_percentage || 0) > 80 ? 'warning' : 'healthy',
        glowColor: 'rgba(168, 85, 247, 0.6)',
        index: 2
      });
    }

    // 系统运行时间
    if (metricsData) {
      cards.push({
        icon: '⏰',
        label: '系统运行时间',
        value: formatUptime(metricsData.uptime),
        glowColor: 'rgba(34, 197, 94, 0.6)',
        index: 3
      });
    }

    // 活跃警报数量
    if (alertsData) {
      const criticalCount = alertsData.critical_count || 0;
      cards.push({
        icon: '🚨',
        label: '活跃警报',
        value: alertsData.count || 0,
        status: criticalCount > 0 ? 'unhealthy' : alertsData.warning_count > 0 ? 'warning' : 'healthy',
        glowColor: 'rgba(239, 68, 68, 0.6)',
        index: 4
      });
    }

    // 健康服务状态
    if (systemStats && systemStats.health) {
      const healthPercentage = systemStats.health.total_services > 0
        ? (systemStats.health.healthy_services / systemStats.health.total_services) * 100
        : 0;
      cards.push({
        icon: '📊',
        label: '健康服务比例',
        value: formatPercentage(healthPercentage),
        status: healthPercentage >= 99 ? 'healthy' :
                healthPercentage >= 80 ? 'warning' : 'unhealthy',
        glowColor: 'rgba(59, 130, 246, 0.6)',
        index: 5
      });
    }

    return cards;
  };

  // 数据加载函数
  useEffect(() => {
    const fetchData = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
        setError(null);

        // 并行请求监控相关API接口
        const [healthResponse, metricsResponse, alertsResponse, statsResponse, summaryResponse, statusResponse] = await Promise.all([
          monitoringAPI.getSystemHealth(),
          monitoringAPI.getLatestMetrics(),
          monitoringAPI.getActiveAlerts(),
          monitoringAPI.getSystemStats().catch((err) => {
            console.warn('系统统计获取失败:', err);
            return null;
          }),
          monitoringAPI.getStatsSummary().catch((err) => {
            console.warn('统计摘要获取失败:', err);
            return null;
          }),
          monitoringAPI.getMonitoringStatus().catch((err) => {
            console.warn('监控状态获取失败:', err);
            return null;
          })
        ]);

        setHealthData(healthResponse);
        setMetricsData(metricsResponse);
        setAlertsData(alertsResponse);
        setSystemStats(statsResponse);
        setStatsSummary(summaryResponse);
        setMonitoringStatus(statusResponse);
      } catch (err) {
        console.error('监控API请求失败:', err);

        // 仅在初始加载时显示错误
        if (isInitialLoad) {
          setError(`获取数据失败: ${err instanceof Error ? err.message : '未知错误'}`);
          setHealthData(null);
          setMetricsData(null);
          setAlertsData(null);
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

    // 初始加载
    fetchData(true);

    // 设置定时刷新（后台静默更新）- 5分钟
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.systemStatus}>
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
      <div className={styles.systemStatus}>
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
    <div className={styles.systemStatus}>
      {/* 页面标题 */}
      <PageHeader
        title="系统监控"
        subtitle="实时监控系统健康状态、性能指标和警报"
        icon="🖥️"
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

      {/* 系统概览 */}
      <StatusOverview cards={getStatusCards()} />

      {/* 导航标签 */}
      <div className={styles.tabNavigation}>
        <button
          className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 系统概览
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'services' ? styles.active : ''}`}
          onClick={() => setActiveTab('services')}
        >
          🔧 服务管理
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'logs' ? styles.active : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 系统日志
        </button>
      </div>

      {/* 标签内容 */}
      {activeTab === 'overview' && (
        <div className={styles.mainGrid}>
          {/* 服务健康检查 */}
          {healthData && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>服务健康检查</h2>
              <p>各个服务组件的健康状态检查</p>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.healthList}>
                {healthData.checks.map((check: HealthCheck, index: number) => (
                  <div key={index} className={styles.healthItem} style={{ '--index': index } as React.CSSProperties}>
                    <div className={styles.healthHeader}>
                      <div className={styles.healthInfo}>
                        <div className={`${styles.statusIndicator} ${getStatusColor(check.status)}`}></div>
                        <span className={styles.serviceName}>{check.service}</span>
                      </div>
                      <span className={styles.responseTime}>{check.response_time}ms</span>
                    </div>
                    <div className={styles.healthMessage}>{check.message}</div>
                    <div className={styles.healthTime}>
                      最后检查: {new Date(check.last_check).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 性能指标 */}
        {metricsData && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>性能指标</h2>
              <p>系统资源使用情况和性能数据</p>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.metricsGrid}>
                {/* API指标 */}
                <div className={styles.metricItem} style={{ '--index': 0 } as React.CSSProperties}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIcon}>🌐</span>
                    <span className={styles.metricName}>API性能</span>
                  </div>
                  <div className={styles.metricValue}>
                    请求: {metricsData.api.request_count} | 错误: {metricsData.api.error_count}
                  </div>
                  <div className={styles.metricDetails}>
                    平均响应时间: {metricsData.api.avg_response_time}ms
                  </div>
                  <div className={styles.metricDetails}>
                    活跃连接: {metricsData.api.active_connections}
                  </div>
                </div>

                {/* WebSocket指标 */}
                <div className={styles.metricItem} style={{ '--index': 1 } as React.CSSProperties}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIcon}>🔌</span>
                    <span className={styles.metricName}>WebSocket</span>
                  </div>
                  <div className={styles.metricValue}>
                    状态: {metricsData.websocket.connected ? '已连接' : '断开'}
                  </div>
                  <div className={styles.metricDetails}>
                    订阅流: {metricsData.websocket.subscribed_streams}
                  </div>
                  <div className={styles.metricDetails}>
                    消息数: {metricsData.websocket.message_count}
                  </div>
                </div>

                {/* 内存指标 */}
                <div className={styles.metricItem} style={{ '--index': 2 } as React.CSSProperties}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIcon}>💾</span>
                    <span className={styles.metricName}>内存使用</span>
                  </div>
                  <div className={styles.metricValue}>
                    {formatBytes(metricsData.memory.used)} / {formatBytes(metricsData.memory.total)}
                  </div>
                  <div className={styles.metricBar}>
                    <div
                      className={styles.metricBarFill}
                      style={{ width: `${metricsData.memory.usage_percentage}%` }}
                    ></div>
                  </div>
                  <div className={styles.metricPercentage}>
                    {formatPercentage(metricsData.memory.usage_percentage)}
                  </div>
                </div>

                {/* CPU指标 */}
                <div className={styles.metricItem} style={{ '--index': 3 } as React.CSSProperties}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIcon}>🔧</span>
                    <span className={styles.metricName}>CPU使用</span>
                  </div>
                  <div className={styles.metricValue}>
                    负载: {metricsData.cpu.load_average.join(', ')}
                  </div>
                  <div className={styles.metricBar}>
                    <div
                      className={styles.metricBarFill}
                      style={{ width: `${metricsData.cpu.usage_percentage}%` }}
                    ></div>
                  </div>
                  <div className={styles.metricPercentage}>
                    {formatPercentage(metricsData.cpu.usage_percentage)}
                  </div>
                </div>

                {/* 数据库指标 */}
                <div className={styles.metricItem} style={{ '--index': 4 } as React.CSSProperties}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIcon}>🗄️</span>
                    <span className={styles.metricName}>MySQL连接</span>
                  </div>
                  <div className={styles.metricValue}>
                    {metricsData.database.mysql.active_connections} / {metricsData.database.mysql.max_connections}
                  </div>
                  <div className={styles.metricBar}>
                    <div
                      className={styles.metricBarFill}
                      style={{ width: `${metricsData.database.mysql.connection_usage_percentage}%` }}
                    ></div>
                  </div>
                  <div className={styles.metricPercentage}>
                    {formatPercentage(metricsData.database.mysql.connection_usage_percentage)}
                  </div>
                </div>

                {/* Redis指标 */}
                <div className={styles.metricItem} style={{ '--index': 5 } as React.CSSProperties}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricIcon}>📦</span>
                    <span className={styles.metricName}>Redis缓存</span>
                  </div>
                  <div className={styles.metricValue}>
                    {formatBytes(metricsData.database.redis.memory_used)} | {metricsData.database.redis.key_count} keys
                  </div>
                  <div className={styles.metricBar}>
                    <div
                      className={styles.metricBarFill}
                      style={{ width: `${metricsData.database.redis.hit_rate}%` }}
                    ></div>
                  </div>
                  <div className={styles.metricPercentage}>
                    命中率: {formatPercentage(metricsData.database.redis.hit_rate)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 系统警报 */}
        {alertsData && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2>系统警报</h2>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  活跃警报数: {alertsData.count}
                </span>
              </div>
              <p>
                严重: {alertsData.critical_count} | 警告: {alertsData.warning_count}
              </p>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.alertsList}>
                {alertsData.alerts.length > 0 ? (
                  alertsData.alerts.map((alert: Alert, index: number) => (
                    <div key={alert.id} className={`${styles.alertItem} ${getSeverityColor(alert.severity)}`} style={{ '--index': index } as React.CSSProperties}>
                      <div className={styles.alertHeader}>
                        <div className={styles.alertInfo}>
                          <span className={styles.alertType}>{alert.type}</span>
                          <span className={`${styles.alertSeverity} ${getSeverityColor(alert.severity)}`}>
                            {alert.severity === 'critical' ? '严重' :
                             alert.severity === 'warning' ? '警告' : '信息'}
                          </span>
                        </div>
                        <span className={styles.alertTime}>
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.alertMessage}>{alert.message}</div>
                      <div className={styles.alertDetails}>
                        <span>当前值: {alert.value}</span>
                        <span>阈值: {alert.threshold}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.icon}>✅</div>
                    <p className={styles.text}>当前无活跃警报</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* 服务管理标签 */}
      {activeTab === 'services' && (
        <div className={styles.mainGrid}>
          {/* 监控服务状态 */}
          {monitoringStatus && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>监控服务状态</h2>
                <p>系统监控服务的运行状态和配置信息</p>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.servicesGrid}>
                  <div className={styles.serviceItem}>
                    <div className={styles.serviceHeader}>
                      <div className={styles.serviceInfo}>
                        <div className={styles.serviceName}>监控服务</div>
                        <div className={`${styles.serviceStatus} ${monitoringStatus.is_running ? styles.running : styles.stopped}`}>
                          <StatusIndicator status={monitoringStatus.is_running ? 'running' : 'stopped'} />
                          {monitoringStatus.is_running ? '运行中' : '已停止'}
                        </div>
                      </div>
                    </div>
                    <div className={styles.serviceDetails}>
                      <div className={styles.serviceDetail}>
                        <div className={styles.detailLabel}>运行时间</div>
                        <div className={styles.detailValue}>{formatUptime(monitoringStatus.uptime)}</div>
                      </div>
                      <div className={styles.serviceDetail}>
                        <div className={styles.detailLabel}>活跃告警</div>
                        <div className={styles.detailValue}>{monitoringStatus.active_alerts_count}</div>
                      </div>
                      <div className={styles.serviceDetail}>
                        <div className={styles.detailLabel}>采集间隔</div>
                        <div className={styles.detailValue}>{monitoringStatus.config.collection_interval / 1000}s</div>
                      </div>
                      <div className={styles.serviceDetail}>
                        <div className={styles.detailLabel}>健康检查间隔</div>
                        <div className={styles.detailValue}>{monitoringStatus.config.health_check_interval / 1000}s</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <div className={styles.detailLabel}>最后采集时间</div>
                      <div className={styles.detailValue}>{new Date(monitoringStatus.latest_collection).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 系统统计摘要 */}
          {statsSummary && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>系统统计摘要</h2>
                <p>系统当前状态的快速概览</p>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>🟢</div>
                    <div className={styles.statValue}>{statsSummary.system_status}</div>
                    <div className={styles.statLabel}>系统状态</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>🚨</div>
                    <div className={styles.statValue}>{statsSummary.active_alerts}</div>
                    <div className={styles.statLabel}>活跃告警</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>⚡</div>
                    <div className={styles.statValue}>{statsSummary.critical_alerts}</div>
                    <div className={styles.statLabel}>紧急告警</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>📊</div>
                    <div className={styles.statValue}>{statsSummary.memory_usage}%</div>
                    <div className={styles.statLabel}>内存使用率</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>🌐</div>
                    <div className={styles.statValue}>{statsSummary.api_requests}</div>
                    <div className={styles.statLabel}>API请求数</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>⏱️</div>
                    <div className={styles.statValue}>{statsSummary.uptime_hours}h</div>
                    <div className={styles.statLabel}>运行时长</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 详细系统统计 */}
          {systemStats && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>详细系统统计</h2>
                <p>各个子系统的详细性能数据</p>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>💾</div>
                    <div className={styles.statValue}>{systemStats.system.memory_usage}%</div>
                    <div className={styles.statLabel}>内存使用率</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>🔧</div>
                    <div className={styles.statValue}>{systemStats.system.cpu_usage}%</div>
                    <div className={styles.statLabel}>CPU使用率</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>🗄️</div>
                    <div className={styles.statValue}>{systemStats.database.mysql_connections}</div>
                    <div className={styles.statLabel}>MySQL连接数</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>⚡</div>
                    <div className={styles.statValue}>{systemStats.api.avg_response_time}ms</div>
                    <div className={styles.statLabel}>API平均响应时间</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>📈</div>
                    <div className={styles.statValue}>{systemStats.api.total_requests}</div>
                    <div className={styles.statLabel}>API总请求数</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>❌</div>
                    <div className={styles.statValue}>{systemStats.api.error_rate}%</div>
                    <div className={styles.statLabel}>API错误率</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 系统日志标签 */}
      {activeTab === 'logs' && (
        <div className={styles.mainGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>系统日志</h2>
              <p>日志功能正在开发中，敬请期待</p>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.emptyState}>
                <div className={styles.icon}>🚧</div>
                <p className={styles.text}>日志查看功能即将上线</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemStatus;