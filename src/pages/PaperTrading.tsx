import React, { useEffect, useState } from 'react';
import { Tabs } from 'antd';
import PageHeader from '../components/ui/PageHeader';
import PaperLivePanel from '../components/paper/PaperLivePanel';
import LiveTradingPanel from '../components/paper/LiveTradingPanel';
import StrategyBacktestPanel from '../components/paper/StrategyBacktestPanel';
import styles from '../components/paper/Paper.module.scss';

interface PaperTradingProps {
  isSidebarCollapsed?: boolean;
}

type TabKey = 'real' | 'paper' | 'backtest';
const TAB_KEY = 'paper.tab';
const TAB_KEYS: TabKey[] = ['real', 'paper', 'backtest'];

const SUBTITLES: Record<TabKey, string> = {
  real: 'MACD 顶背离策略币安实盘：真实下单，只读展示',
  paper: 'MACD 顶背离策略实盘行情模拟：信号 → 条件单 → 自动撮合',
  backtest: '离线全市场回测结果：统计、逐笔K线与形态标注',
};

// 跟随全局明暗主题（App 在 <html> 上切换 .dark）
const useIsDark = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

const readTab = (): TabKey => {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === 'live') return 'paper'; // 旧版本里模拟盘的 key
    return TAB_KEYS.includes(v as TabKey) ? (v as TabKey) : 'real';
  } catch {
    return 'real';
  }
};

const PaperTrading: React.FC<PaperTradingProps> = () => {
  const isDark = useIsDark();
  const [tab, setTab] = useState<TabKey>(readTab);

  const changeTab = (key: string) => {
    const next = key as TabKey;
    setTab(next);
    try { localStorage.setItem(TAB_KEY, next); } catch { /* 忽略 */ }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="策略交易" subtitle={SUBTITLES[tab]} icon="🧪" />

      {/* 只渲染当前 Tab：切走后停止该 Tab 的轮询 */}
      <Tabs
        className={styles.tabs}
        activeKey={tab}
        onChange={changeTab}
        items={[
          { key: 'real', label: '实盘', children: tab === 'real' ? <LiveTradingPanel isDark={isDark} /> : null },
          { key: 'paper', label: '模拟盘', children: tab === 'paper' ? <PaperLivePanel isDark={isDark} /> : null },
          { key: 'backtest', label: '策略回测', children: tab === 'backtest' ? <StrategyBacktestPanel isDark={isDark} /> : null },
        ]}
      />
    </div>
  );
};

export default PaperTrading;
