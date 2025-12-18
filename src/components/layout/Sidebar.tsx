import React, { useState, useEffect } from 'react';
import styles from './Sidebar.module.scss';
import { mockPortfolioStats, formatCurrency, formatPercent } from '../../utils/mockData';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isCollapsed,
  onToggleCollapse,
  onClose
}) => {
  // 获取当前页面
  const getCurrentPage = () => {
    const hash = window.location.hash.slice(1);
    return hash || 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState(getCurrentPage());

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(getCurrentPage());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navSections = [
    {
      title: '主要功能',
      items: [
        { icon: '📊', label: '仪表板', href: '#', page: 'dashboard' },
        { icon: '💹', label: 'K线图表', href: '#kline-chart', page: 'kline-chart' },
        { icon: '📊', label: 'OI监控', href: '#oi-monitoring', page: 'oi-monitoring' },
        { icon: '🚀', label: '突破信号', href: '#breakout-signals', page: 'breakout-signals' },
        { icon: '📡', label: '信号监控', href: '#signal-monitor', page: 'signal-monitor' }
      ]
    },
    {
      title: '链上数据 ⛓️',
      items: [
        { icon: '🔍', label: '潜力币种', href: '#potential-tokens', page: 'potential-tokens' },
        { icon: '👁️', label: '监控币种', href: '#monitor-tokens', page: 'monitor-tokens' },
        { icon: '🗑️', label: '已删除代币', href: '#deleted-tokens', page: 'deleted-tokens' },
        { icon: '⚙️', label: '任务管理', href: '#task-management', page: 'task-management' }
        // { icon: '📈', label: '链上K线', href: '#blockchain-charts', page: 'blockchain-charts' },
        // { icon: '📊', label: '数据统计', href: '#blockchain-stats', page: 'blockchain-stats' }
      ]
    },
    {
      title: '量化交易 🤖',
      items: [
        { icon: '🎯', label: '量化仪表板', href: '#quant', page: 'quant' },
        { icon: '📋', label: '策略管理', href: '#quant-strategies', page: 'quant-strategies' },
        { icon: '🧪', label: '回测实验室', href: '#quant-backtest', page: 'quant-backtest' },
        { icon: '📡', label: '信号监控', href: '#quant-signals', page: 'quant-signals' },
        { icon: '📈', label: '交易分析', href: '#quant-trades', page: 'quant-trades' },
        { icon: '💼', label: '持仓监控', href: '#quant-positions', page: 'quant-positions' },
        { icon: '⚠️', label: '风险管理', href: '#quant-risk', page: 'quant-risk' }
      ]
    },
    {
      title: '市场数据',
      items: [
        { icon: '🏪', label: '市场概览', href: '#' },
        { icon: '📈', label: '热门币种', href: '#' },
        { icon: '⚡', label: '实时数据', href: '#' }
      ]
    },
    {
      title: '系统管理',
      items: [
        { icon: '🪙', label: '币种配置', href: '#symbol-config', page: 'symbol-config' },
        { icon: '🔍', label: '系统状态', href: '#system-status', page: 'system-status' },
        { icon: '⚙️', label: '系统设置', href: '#' },
        { icon: '👤', label: '账户管理', href: '#' },
        { icon: '📋', label: '操作日志', href: '#' }
      ]
    }
  ];

  return (
    <>
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>导航菜单</h2>
          <button
            className={styles.collapseButton}
            onClick={onToggleCollapse}
            title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className={styles.nav}>
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className={styles.navSection}>
              <div className={styles.sectionTitle}>{section.title}</div>
              {section.items.map((item, itemIndex) => (
                <a
                  key={itemIndex}
                  href={item.href}
                  className={`${styles.navItem} ${(item.page && item.page === currentPage) ? styles.active : ''}`}
                  onClick={() => window.innerWidth <= 1024 && onClose()}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.label}>{item.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.portfolioStats}>
          <div className={styles.statsTitle}>投资组合概览</div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>总资产</span>
            <span className={styles.statValue}>
              {formatCurrency(mockPortfolioStats.totalValue)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>总盈亏</span>
            <span className={`${styles.statValue} ${mockPortfolioStats.totalPnL >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(mockPortfolioStats.totalPnL)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>今日盈亏</span>
            <span className={`${styles.statValue} ${mockPortfolioStats.dayPnL >= 0 ? styles.positive : styles.negative}`}>
              {formatPercent(mockPortfolioStats.dayPnLPercent)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>持仓数量</span>
            <span className={styles.statValue}>{mockPortfolioStats.activePositions}</span>
          </div>
        </div>
      </aside>

      <div
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
        onClick={onClose}
      />
    </>
  );
};

export default Sidebar;