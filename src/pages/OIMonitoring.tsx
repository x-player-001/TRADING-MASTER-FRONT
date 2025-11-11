import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DatePicker, Input } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import styles from './OIMonitoring.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { StatusOverview, StatusIndicator, StatusCardProps, TopProgressBar, DataSection, CoolRefreshButton, SeverityFilter } from '../components/ui';
import { OIStatisticsTable } from '../components/oi/OIStatisticsTable';
import { OIAnomaliesList } from '../components/oi/OIAnomaliesList';
import { useOIMonitoring } from '../hooks/useOIMonitoring';
import { useOIFilters } from '../hooks/useOIFilters';
import { useTopProgress } from '../hooks/useTopProgress';
import { formatUptime } from '../utils/oiFormatters';


// 常量定义 - 避免在组件内部重复创建
const REFRESH_ICON_STYLES = {
  padding: '0.5rem',
  fontSize: '1rem',
  background: 'transparent',
  border: 'none',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  color: '#6b7280',
  transition: 'color 0.2s'
} as const;


const OIMonitoring: React.FC = () => {
  // 状态管理
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // 使用自定义Hook管理数据获取
  const {
    statistics,
    anomalies,
    serviceStatus,
    loading,
    isRefreshing,
    error,
    refresh,
    loadingStates
  } = useOIMonitoring({ selectedDate });

  // 顶部进度条控制
  const { isVisible: progressVisible, progress, start: startProgress, finish: finishProgress } = useTopProgress();

  // 使用自定义Hook管理数据筛选
  const { filteredStatistics, filteredAnomalies, counts } = useOIFilters({
    statistics,
    anomalies,
    searchTerm,
    severityFilter
  });

  // 优化：使用useMemo缓存状态卡片数据，避免重复计算
  const statusCards = useMemo((): StatusCardProps[] => {
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
      glowColor: 'rgba(245, 158, 11, 0.6)',
      index: 1
    });

    // 轮询间隔
    cards.push({
      icon: '⏱️',
      label: '轮询间隔',
      value: serviceStatus?.config?.polling_interval_ms
        ? `${serviceStatus.config.polling_interval_ms / 1000}s`
        : '30s',
      glowColor: 'rgba(139, 92, 246, 0.6)',
      index: 2
    });

    // 服务运行时间
    cards.push({
      icon: '📈',
      label: '运行时间',
      value: serviceStatus?.uptime_ms ? formatUptime(serviceStatus.uptime_ms) : '--',
      glowColor: 'rgba(34, 197, 94, 0.6)',
      index: 3
    });

    // 最后轮询时间
    cards.push({
      icon: '🕐',
      label: '最后轮询',
      value: serviceStatus?.last_poll_time ? new Date(serviceStatus.last_poll_time).toLocaleString() : '--',
      glowColor: 'rgba(168, 85, 247, 0.6)',
      index: 4
    });

    return cards;
  }, [serviceStatus]);

  // 优化：使用useCallback缓存事件处理器
  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // 自动控制进度条
  useEffect(() => {
    if (isRefreshing) {
      startProgress();
    } else {
      finishProgress();
    }
  }, [isRefreshing, startProgress, finishProgress]);

  // 只在严重错误时显示错误页面，否则显示固定布局
  const hasError = error && !statistics && !anomalies;

  return (
    <div className={styles.oiMonitoring}>
      {/* 顶部进度条 - 绝对定位在容器顶部 */}
      <TopProgressBar
        isVisible={progressVisible || isRefreshing || loading}
        progress={loading ? 50 : (isRefreshing ? 85 : progress)}
        absolute
      />

      {/* 严重错误时显示错误页面 */}
      {hasError ? (
        <div className={styles.error}>
          <div className={styles.content}>
            <div className={styles.icon}>⚠️</div>
            <div className={styles.text}>{error}</div>
          </div>
        </div>
      ) : (
        <>
          {/* 页面标题 */}
          <PageHeader
            title="OI监控中心"
            subtitle="实时监控开放权益数据，异常检测与预警"
            icon="📊"
          />

      {/* 服务状态概览 */}
      <StatusOverview cards={statusCards} />

      {/* 筛选器 */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>日期：</label>
            <DatePicker
              placeholder="选择日期"
              value={selectedDate}
              onChange={setSelectedDate}
              allowClear
              format="YYYY-MM-DD"
              style={{
                width: 200,
                background: 'transparent',
                backgroundColor: 'transparent'
              }}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>代币：</label>
            <Input
              placeholder="输入代币名称..."
              value={searchTerm}
              onChange={handleSearchChange}
              allowClear
              style={{
                width: 250,
                background: 'transparent',
                backgroundColor: 'transparent'
              }}
            />
          </div>
          <div className={styles.filterItem}>
            <CoolRefreshButton
              onClick={handleRefresh}
              loading={isRefreshing}
              size="small"
              iconOnly
            />
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* OI统计数据 */}
        <DataSection
          title="OI统计数据"
          subtitle={searchTerm
            ? `原始数据：${counts.originalStatistics} 个币种，筛选后：${counts.filteredStatistics} 个币种`
            : `共 ${counts.originalStatistics} 个币种正在监控`
          }
          loading={loading || loadingStates.statistics}
          error={null}
          empty={!loading && !loadingStates.statistics && (!filteredStatistics || filteredStatistics.length === 0)}
          emptyText="暂无统计数据"
        >
          <OIStatisticsTable data={filteredStatistics} />
        </DataSection>

        {/* 异常监测 */}
        <DataSection
          title="异常监测"
          subtitle={searchTerm || severityFilter !== 'all'
            ? `原始异常：${counts.originalAnomalies} 个，筛选后：${counts.filteredAnomalies} 个`
            : `共发现 ${counts.originalAnomalies} 个异常`
          }
          loading={loading || loadingStates.anomalies}
          error={null}
          empty={!loading && !loadingStates.anomalies && (!filteredAnomalies || filteredAnomalies.length === 0)}
          emptyText="暂无异常检测"
          headerActions={
            <SeverityFilter
              value={severityFilter}
              onChange={setSeverityFilter}
              size="small"
            />
          }
        >
          <OIAnomaliesList data={filteredAnomalies} />
        </DataSection>
      </div>
        </>
      )}
    </div>
  );
};



export default OIMonitoring;