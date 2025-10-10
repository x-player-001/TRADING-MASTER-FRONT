import React from 'react';
import styles from './Dashboard.module.scss';
import MarketOverview from '../components/market/MarketOverview';
import TradingSignals from '../components/market/TradingSignals';
import { mockPortfolioStats, formatCurrency, formatPercent } from '../utils/mockData';
import PageHeader from '../components/ui/PageHeader';

const Dashboard: React.FC = () => {
  const stats = [
    {
      icon: '💰',
      label: '总资产价值',
      value: formatCurrency(mockPortfolioStats.totalValue),
      change: formatPercent(mockPortfolioStats.totalPnLPercent),
      changeType: mockPortfolioStats.totalPnL >= 0 ? 'positive' : 'negative',
      type: 'primary'
    },
    {
      icon: '📈',
      label: '今日盈亏',
      value: formatCurrency(mockPortfolioStats.dayPnL),
      change: formatPercent(mockPortfolioStats.dayPnLPercent),
      changeType: mockPortfolioStats.dayPnL >= 0 ? 'positive' : 'negative',
      type: mockPortfolioStats.dayPnL >= 0 ? 'success' : 'danger'
    },
    {
      icon: '🎯',
      label: '活跃持仓',
      value: mockPortfolioStats.activePositions.toString(),
      change: '+2 本周',
      changeType: 'positive',
      type: 'warning'
    },
    {
      icon: '⚡',
      label: '信号准确率',
      value: '87.5%',
      change: '+2.3% 本月',
      changeType: 'positive',
      type: 'success'
    }
  ];

  const handleRefresh = () => {
    // 模拟刷新数据
    console.log('刷新数据...');
  };

  return (
    <div className={styles.dashboard}>
      <PageHeader
        title="交易仪表板"
        subtitle="欢迎回来！以下是您的交易概览和最新市场动态"
        icon="📈"
      >
        <button className={styles.refreshButton} onClick={handleRefresh}>
          <span>🔄</span>
          刷新数据
        </button>
      </PageHeader>

      {/* 统计卡片网格 */}
      <div className={styles.grid}>
        {stats.map((stat, index) => (
          <div key={index} className={`${styles.statCard} ${styles[stat.type]}`}>
            <div className={styles.statIcon}>{stat.icon}</div>
            <div className={styles.statValue}>{stat.value}</div>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={`${styles.statChange} ${styles[stat.changeType]}`}>
              {stat.change}
            </div>
          </div>
        ))}
      </div>

      {/* 主要内容网格 */}
      <div className={styles.mainGrid}>
        {/* 左侧：市场概览和K线图 */}
        <div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>市场概览</h2>
              <a href="#" className={styles.cardAction}>查看全部</a>
            </div>
            <MarketOverview />
          </div>

          <div className={styles.card} style={{ marginTop: '2rem' }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>BTC/USDT 实时图表</h2>
              <a href="#" className={styles.cardAction}>全屏查看</a>
            </div>
            <div className={styles.chartPlaceholder}>
              <div className={styles.icon}>📊</div>
              <div className={styles.text}>
                <div>K线图表组件</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.5rem' }}>
                  TradingView集成即将上线
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：交易信号和系统状态 */}
        <div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>最新交易信号</h2>
              <a href="#" className={styles.cardAction}>查看历史</a>
            </div>
            <TradingSignals />
          </div>

          <div className={styles.card} style={{ marginTop: '2rem' }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>系统状态</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>系统状态</span>
                <span style={{ color: '#10b981', fontWeight: '600' }}>🟢 正常运行</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>延迟</span>
                <span style={{ fontWeight: '600' }}>42ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>活跃会话</span>
                <span style={{ fontWeight: '600' }}>1,247</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>正常运行时间</span>
                <span style={{ color: '#10b981', fontWeight: '600' }}>99.97%</span>
              </div>
            </div>
          </div>

          <div className={styles.card} style={{ marginTop: '2rem' }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>快速操作</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button style={{
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}>
                🎯 创建新规则
              </button>
              <button style={{
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}>
                📊 查看回测
              </button>
              <button style={{
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}>
                ⚙️ 系统设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;