import React, { useState, useEffect } from 'react';
import styles from './SystemStatus.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { blockchainAPI } from '../services/blockchainAPI';
import type { StatsResponse, HealthResponse } from '../types/blockchain';

const BlockchainStats: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      setError(null);

      const [statsRes, healthRes] = await Promise.all([
        blockchainAPI.getStats(),
        blockchainAPI.healthCheck()
      ]);

      setStats(statsRes);
      setHealth(healthRes);
    } catch (err: any) {
      console.error('获取链上数据统计失败:', err);
      setError(err.message || '获取统计数据失败');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000); // 30秒刷新
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchData(true);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="链上数据统计"
        subtitle="BSC链上代币和市场数据统计概览"
        icon="⛓️"
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {health && (
            <span className={styles.statusBadge} style={{
              background: health.status === 'healthy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: health.status === 'healthy' ? '#10b981' : '#ef4444',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              fontSize: '0.875rem'
            }}>
              {health.status === 'healthy' ? '✓ 服务正常' : '✗ 服务异常'}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={styles.refreshButton}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.6 : 1
            }}
          >
            {isRefreshing ? '🔄 刷新中...' : '🔄 刷新'}
          </button>
        </div>
      </PageHeader>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : error ? (
          <div className={styles.error}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <p>{error}</p>
            <small>请确保链上数据服务已启动（端口8888）</small>
          </div>
        ) : stats ? (
          <div className={styles.statsGrid}>
            {/* 总览卡片 */}
            <div className={styles.statCard} style={{ gridColumn: 'span 2' }}>
              <div className={styles.cardHeader}>
                <h3>📊 总览</h3>
                <span className={styles.timestamp}>
                  更新时间: {new Date(stats.updated_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className={styles.overviewGrid}>
                <div className={styles.overviewItem}>
                  <div className={styles.label}>代币总数</div>
                  <div className={styles.value}>{stats.total_tokens}</div>
                </div>
                <div className={styles.overviewItem}>
                  <div className={styles.label}>K线记录数</div>
                  <div className={styles.value}>{stats.total_ohlcv}</div>
                </div>
                <div className={styles.overviewItem}>
                  <div className={styles.label}>数据源数量</div>
                  <div className={styles.value}>{stats.sources.length}</div>
                </div>
                <div className={styles.overviewItem}>
                  <div className={styles.label}>平均K线/代币</div>
                  <div className={styles.value}>
                    {stats.total_tokens > 0 ? (stats.total_ohlcv / stats.total_tokens).toFixed(2) : '0'}
                  </div>
                </div>
              </div>
            </div>

            {/* 数据源统计 */}
            <div className={styles.statCard} style={{ gridColumn: 'span 2' }}>
              <div className={styles.cardHeader}>
                <h3>📦 数据源统计</h3>
              </div>
              <div className={styles.sourceList}>
                {stats.sources.map((source, index) => (
                  <div key={index} className={styles.sourceItem}>
                    <div className={styles.sourceHeader}>
                      <span className={styles.sourceName}>{source.source.toUpperCase()}</span>
                      <span className={styles.sourcePercentage}>
                        {((source.token_count / stats.total_tokens) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className={styles.sourceProgress}>
                      <div
                        className={styles.progressBar}
                        style={{
                          width: `${(source.token_count / stats.total_tokens) * 100}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #6366f1)'
                        }}
                      />
                    </div>
                    <div className={styles.sourceStats}>
                      <span>代币数: {source.token_count}</span>
                      <span>K线数: {source.ohlcv_count}</span>
                      <span>平均: {(source.ohlcv_count / source.token_count).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BlockchainStats;
