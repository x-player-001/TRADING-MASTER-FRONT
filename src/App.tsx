import React, { useState, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import OIMonitoring from './pages/OIMonitoring';
import BreakoutSignals from './pages/BreakoutSignals';
import SystemStatus from './pages/SystemStatus';
import KlineChart from './pages/KlineChart';
import SymbolConfig from './pages/SymbolConfig';
// 量化交易模块
import QuantDashboard from './quantitative/pages/QuantDashboard';
import StrategyManage from './quantitative/pages/StrategyManage';
import BacktestLab from './quantitative/pages/BacktestLab';
import TradeAnalysis from './quantitative/pages/TradeAnalysis';
import PositionMonitor from './quantitative/pages/PositionMonitor';
import RiskManagement from './quantitative/pages/RiskManagement';
import QuantSignalMonitor from './quantitative/pages/SignalMonitor';
import SignalMonitor from './pages/SignalMonitor';
// 链上数据模块
import PotentialTokens from './pages/PotentialTokens';
import MonitorTokens from './pages/MonitorTokens';
import DeletedTokens from './pages/DeletedTokens';
import BlockchainCharts from './pages/BlockchainCharts';
import BlockchainStats from './pages/BlockchainStats';
import TokenAnalysis from './pages/TokenAnalysis';
import TaskManagement from './pages/TaskManagement';

function App() {
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    // 检查本地存储中的主题设置
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    // 检查系统偏好
    if (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    // 检查侧边栏折叠状态
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState === 'true') {
      setIsSidebarCollapsed(true);
    }

    // 响应式处理
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };

    // 初始检查
    handleResize();

    // 处理URL hash变化
    const handleHashChange = () => {
      const fullHash = window.location.hash.slice(1);
      // 分离路由名称和查询参数（例如：token-analysis?symbol=BTC）
      const hash = fullHash.split('?')[0];

      if (hash === 'oi-monitoring') {
        setCurrentPage('oi-monitoring');
      } else if (hash === 'breakout-signals') {
        setCurrentPage('breakout-signals');
      } else if (hash === 'system-status') {
        setCurrentPage('system-status');
      } else if (hash === 'kline-chart') {
        setCurrentPage('kline-chart');
      } else if (hash === 'symbol-config') {
        setCurrentPage('symbol-config');
      } else if (hash === 'quant') {
        setCurrentPage('quant');
      } else if (hash === 'quant-strategies') {
        setCurrentPage('quant-strategies');
      } else if (hash === 'quant-backtest') {
        setCurrentPage('quant-backtest');
      } else if (hash === 'quant-trades') {
        setCurrentPage('quant-trades');
      } else if (hash === 'quant-positions') {
        setCurrentPage('quant-positions');
      } else if (hash === 'quant-risk') {
        setCurrentPage('quant-risk');
      } else if (hash === 'quant-signals') {
        setCurrentPage('quant-signals');
      } else if (hash === 'signal-monitor') {
        setCurrentPage('signal-monitor');
      } else if (hash === 'potential-tokens') {
        setCurrentPage('potential-tokens');
      } else if (hash === 'monitor-tokens') {
        setCurrentPage('monitor-tokens');
      } else if (hash === 'deleted-tokens') {
        setCurrentPage('deleted-tokens');
      } else if (hash === 'blockchain-charts') {
        setCurrentPage('blockchain-charts');
      } else if (hash === 'blockchain-stats') {
        setCurrentPage('blockchain-stats');
      } else if (hash === 'token-analysis') {
        setCurrentPage('token-analysis');
      } else if (hash === 'task-management') {
        setCurrentPage('task-management');
      } else {
        setCurrentPage('dashboard');
      }
    };

    // 初始路由检查
    handleHashChange();

    window.addEventListener('resize', handleResize);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleThemeToggle = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);

    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSidebarToggle = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };

  const handleSidebarCollapse = () => {
    const newCollapsed = !isSidebarCollapsed;
    setIsSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', newCollapsed.toString());
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'oi-monitoring':
        return <OIMonitoring />;
      case 'breakout-signals':
        return <BreakoutSignals isSidebarCollapsed={isSidebarCollapsed} />;
      case 'system-status':
        return <SystemStatus />;
      case 'kline-chart':
        return <KlineChart />;
      case 'symbol-config':
        return <SymbolConfig />;
      // 量化交易模块页面
      case 'quant':
        return <QuantDashboard isSidebarCollapsed={isSidebarCollapsed} />;
      case 'quant-strategies':
        return <StrategyManage isSidebarCollapsed={isSidebarCollapsed} />;
      case 'quant-backtest':
        return <BacktestLab isSidebarCollapsed={isSidebarCollapsed} />;
      case 'quant-trades':
        return <TradeAnalysis isSidebarCollapsed={isSidebarCollapsed} />;
      case 'quant-positions':
        return <PositionMonitor isSidebarCollapsed={isSidebarCollapsed} />;
      case 'quant-risk':
        return <RiskManagement isSidebarCollapsed={isSidebarCollapsed} />;
      case 'quant-signals':
        return <QuantSignalMonitor isSidebarCollapsed={isSidebarCollapsed} />;
      case 'signal-monitor':
        return <SignalMonitor isSidebarCollapsed={isSidebarCollapsed} />;
      // 链上数据模块页面
      case 'potential-tokens':
        return <PotentialTokens isSidebarCollapsed={isSidebarCollapsed} />;
      case 'monitor-tokens':
        return <MonitorTokens isSidebarCollapsed={isSidebarCollapsed} />;
      case 'deleted-tokens':
        return <DeletedTokens isSidebarCollapsed={isSidebarCollapsed} />;
      case 'blockchain-charts':
        return <BlockchainCharts />;
      case 'blockchain-stats':
        return <BlockchainStats />;
      case 'token-analysis':
        return <TokenAnalysis isSidebarCollapsed={isSidebarCollapsed} />;
      case 'task-management':
        return <TaskManagement isSidebarCollapsed={isSidebarCollapsed} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <div className="app">
        <Header
          isDark={isDark}
          onThemeToggle={handleThemeToggle}
        />

        <Sidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleSidebarCollapse}
          onClose={handleSidebarClose}
        />

        <main className={isSidebarCollapsed ? 'sidebarCollapsed' : ''}>
          {renderCurrentPage()}
        </main>

      {/* 移动端侧边栏触发器 */}
      {isMobile && (
        <button
          onClick={handleSidebarToggle}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            color: 'white',
            border: 'none',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            zIndex: 1000,
            fontSize: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          📊
        </button>
      )}
      </div>
    </ConfigProvider>
  );
}

export default App;