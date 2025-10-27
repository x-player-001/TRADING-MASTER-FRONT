import React, { useState } from 'react';
import styles from './TaskManagement.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar } from '../components/ui';
import ScraperConfig from '../components/blockchain/ScraperConfig';
import ScraperStats from '../components/blockchain/ScraperStats';
import MonitorConfig from '../components/blockchain/MonitorConfig';
import MonitorStats from '../components/blockchain/MonitorStats';

interface Props {
  isSidebarCollapsed?: boolean;
}

const TaskManagement: React.FC<Props> = ({ isSidebarCollapsed }) => {
  const [activeTab, setActiveTab] = useState<'scraper' | 'monitor'>('scraper');

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={false} absolute />

      <PageHeader
        title="任务管理"
        subtitle="配置和监控数据采集与监控任务"
        icon="⚙️"
      />

      <div className={styles.container}>
        {/* Tab 切换 */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === 'scraper' ? styles.active : ''}`}
            onClick={() => setActiveTab('scraper')}
          >
            <span className={styles.tabIcon}>🕷️</span>
            <div className={styles.tabContent}>
              <span className={styles.tabTitle}>数据爬取</span>
              <span className={styles.tabDesc}>DexScreener 潜力代币采集</span>
            </div>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'monitor' ? styles.active : ''}`}
            onClick={() => setActiveTab('monitor')}
          >
            <span className={styles.tabIcon}>📊</span>
            <div className={styles.tabContent}>
              <span className={styles.tabTitle}>数据监控</span>
              <span className={styles.tabDesc}>代币价格与市值实时监控</span>
            </div>
          </button>
        </div>

        {/* Tab 内容 */}
        <div className={styles.tabContent}>
          {activeTab === 'scraper' && (
            <div className={styles.taskSection}>
              <ScraperConfig />
              <ScraperStats />
            </div>
          )}
          {activeTab === 'monitor' && (
            <div className={styles.taskSection}>
              <MonitorConfig />
              <MonitorStats />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskManagement;
