import React from 'react';
import styles from './ScraperManagement.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar } from '../components/ui';
import ScraperConfig from '../components/blockchain/ScraperConfig';
import ScraperStats from '../components/blockchain/ScraperStats';

interface Props {
  isSidebarCollapsed?: boolean;
}

const ScraperManagement: React.FC<Props> = ({ isSidebarCollapsed }) => {
  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={false} absolute />

      <PageHeader
        title="爬虫管理"
        subtitle="配置和监控 DexScreener 数据爬取任务"
        icon="🕷️"
      />

      <div className={styles.container}>
        {/* 爬虫配置模块 */}
        <ScraperConfig />

        {/* 运行情况模块 */}
        <ScraperStats />
      </div>
    </div>
  );
};

export default ScraperManagement;
