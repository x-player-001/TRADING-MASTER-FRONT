/**
 * 量化交易仪表板
 */

import React, { useEffect } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import { useStrategyData } from '../hooks/useStrategyData';
import { useBacktest } from '../hooks/useBacktest';
import { usePositionMonitor } from '../hooks/usePositionMonitor';
import { formatCurrency, formatPercent, formatNumber, formatStrategyType } from '../utils';
import styles from './QuantDashboard.module.scss';

interface QuantDashboardProps {
  isSidebarCollapsed?: boolean;
}

const QuantDashboard: React.FC<QuantDashboardProps> = ({ isSidebarCollapsed }) => {
  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };
  const { strategies, isLoading: stratLoading } = useStrategyData();
  const { backtests, isLoading: backLoading, fetchBacktests } = useBacktest();
  const { statistics: posStats, fetchStatistics } = usePositionMonitor();

  // 初始化加载数据
  useEffect(() => {
    fetchBacktests({ limit: 10 }); // 加载最近10条回测
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只执行一次

  // 当策略加载完成后，获取第一个策略的持仓统计
  useEffect(() => {
    if (strategies.length > 0) {
      fetchStatistics({ strategy_id: strategies[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategies.length]); // 只依赖长度变化，避免重复请求

  // 计算总体统计
  const totalStrategies = strategies.length;
  const activeStrategies = strategies.filter(s => s.enabled).length;
  const totalBacktests = backtests.length;
  const avgSharpe = backtests.length > 0
    ? backtests.reduce((sum, b) => sum + b.sharpe_ratio, 0) / backtests.length
    : 0;

  const stats = [
    {
      icon: '🎯',
      label: '总策略数',
      value: totalStrategies.toString(),
      change: `${activeStrategies} 已启用`,
      type: 'primary'
    },
    {
      icon: '🧪',
      label: '回测次数',
      value: totalBacktests.toString(),
      change: '最近7天',
      type: 'success'
    },
    {
      icon: '📊',
      label: '平均夏普比',
      value: avgSharpe.toFixed(2),
      change: avgSharpe > 1.5 ? '表现良好' : '需要优化',
      type: avgSharpe > 1.5 ? 'success' : 'warning'
    },
    {
      icon: '💼',
      label: '总持仓',
      value: posStats ? posStats.open_positions.toString() : '0',
      change: posStats ? formatCurrency(posStats.total_unrealized_pnl) : '$0',
      type: (posStats?.total_unrealized_pnl || 0) >= 0 ? 'success' : 'danger'
    }
  ];

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="量化交易仪表板"
        subtitle="策略管理、回测分析、交易监控一站式平台"
        icon="🤖"
      >
        <button className={styles.createBtn} onClick={() => navigateTo('quant-strategies')}>
          <span>➕</span>
          创建策略
        </button>
      </PageHeader>

      {/* 统计卡片 */}
      <div className={styles.statsGrid}>
        {stats.map((stat, index) => (
          <div key={index} className={`${styles.statCard} ${styles[stat.type]}`}>
            <div className={styles.statIcon}>{stat.icon}</div>
            <div className={styles.statValue}>{stat.value}</div>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={styles.statChange}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div className={styles.mainGrid}>
        {/* 策略概览 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>策略概览</h2>
            <button className={styles.linkBtn} onClick={() => navigateTo('quant-strategies')}>
              查看全部 →
            </button>
          </div>
          <div className={styles.cardContent}>
            {stratLoading ? (
              <div className={styles.loading}>加载中...</div>
            ) : strategies.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>📋</span>
                <p>暂无策略</p>
                <button className={styles.primaryBtn} onClick={() => navigateTo('quant-strategies')}>
                  创建第一个策略
                </button>
              </div>
            ) : (
              <div className={styles.strategyList}>
                {strategies.slice(0, 5).map((strategy) => (
                  <div key={strategy.id} className={styles.strategyItem}>
                    <div className={styles.strategyInfo}>
                      <div className={styles.strategyName}>
                        {strategy.name}
                        {strategy.enabled && <span className={styles.badge}>运行中</span>}
                      </div>
                      <div className={styles.strategyType}>
                        {formatStrategyType(strategy.type)}
                      </div>
                    </div>
                    <button className={styles.detailBtn} onClick={() => navigateTo('quant-strategies')}>
                      详情
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 最近回测 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>最近回测</h2>
            <button className={styles.linkBtn} onClick={() => navigateTo('quant-backtest')}>
              查看全部 →
            </button>
          </div>
          <div className={styles.cardContent}>
            {backLoading ? (
              <div className={styles.loading}>加载中...</div>
            ) : backtests.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🧪</span>
                <p>暂无回测记录</p>
                <button className={styles.primaryBtn} onClick={() => navigateTo('quant-backtest')}>
                  开始回测
                </button>
              </div>
            ) : (
              <div className={styles.backtestList}>
                {backtests.slice(0, 5).map((backtest) => (
                  <div key={backtest.id} className={styles.backtestItem}>
                    <div className={styles.backtestInfo}>
                      <div className={styles.backtestSymbol}>{backtest.symbol}</div>
                      <div className={styles.backtestStats}>
                        收益: {formatPercent(backtest.total_return)} |
                        夏普: {backtest.sharpe_ratio.toFixed(2)}
                      </div>
                    </div>
                    <div className={`${styles.returnBadge} ${backtest.total_return >= 0 ? styles.positive : styles.negative}`}>
                      {formatPercent(backtest.total_return)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className={styles.quickActions}>
        <h3 className={styles.sectionTitle}>快捷操作</h3>
        <div className={styles.actionGrid}>
          <button className={styles.actionCard} onClick={() => navigateTo('quant-strategies')}>
            <span className={styles.actionIcon}>📋</span>
            <span className={styles.actionTitle}>策略管理</span>
            <span className={styles.actionDesc}>创建和管理交易策略</span>
          </button>
          <button className={styles.actionCard} onClick={() => navigateTo('quant-backtest')}>
            <span className={styles.actionIcon}>🧪</span>
            <span className={styles.actionTitle}>回测实验室</span>
            <span className={styles.actionDesc}>测试策略历史表现</span>
          </button>
          <button className={styles.actionCard} onClick={() => navigateTo('quant-trades')}>
            <span className={styles.actionIcon}>📈</span>
            <span className={styles.actionTitle}>交易分析</span>
            <span className={styles.actionDesc}>查看交易历史和统计</span>
          </button>
          <button className={styles.actionCard} onClick={() => navigateTo('quant-risk')}>
            <span className={styles.actionIcon}>⚠️</span>
            <span className={styles.actionTitle}>风险管理</span>
            <span className={styles.actionDesc}>配置风控参数</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuantDashboard;
