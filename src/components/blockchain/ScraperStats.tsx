import React, { useState, useEffect } from 'react';
import { blockchainAPI } from '../../services/blockchainAPI';
import type { ScraperStats as ScraperStatsType } from '../../types/blockchain';
import styles from './ScraperStats.module.scss';

const ScraperStats: React.FC = () => {
  const [stats, setStats] = useState<ScraperStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    // 每30秒刷新一次
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await blockchainAPI.getScraperStats();
      setStats(data);
    } catch (err: any) {
      console.error('获取爬虫统计失败:', err);
      setError(err.message || '获取爬虫统计失败');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return '-';
    // 服务器返回UTC时间，添加Z标记确保正确解析
    const dateStr = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
    const date = new Date(dateStr);
    // 转换为北京时间（UTC+8）显示
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}秒`;
    return `${(seconds / 60).toFixed(1)}分钟`;
  };

  if (loading && !stats) {
    return (
      <div className={styles.statsCard}>
        <div className={styles.loading}>⏳ 加载统计中...</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className={styles.statsCard}>
        <div className={styles.error}>❌ {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.statsCard}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.icon}>📊</span>
          <h3>运行情况</h3>
        </div>
        <button className={styles.refreshBtn} onClick={fetchStats} disabled={loading}>
          {loading ? '⏳' : '🔄'} 刷新
        </button>
      </div>

      <div className={styles.body}>
        {/* 总体统计 */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>总体统计</h4>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.label}>总运行次数</span>
              <span className={styles.value}>{stats?.summary.total_runs || 0}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.label}>成功次数</span>
              <span className={`${styles.value} ${styles.success}`}>
                {stats?.summary.success_count || 0}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.label}>失败次数</span>
              <span className={`${styles.value} ${styles.failed}`}>
                {stats?.summary.failed_count || 0}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.label}>成功率</span>
              <span className={styles.value}>
                {stats?.summary.success_rate ? `${stats.summary.success_rate.toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.label}>总抓取币种数</span>
              <span className={styles.value}>{stats?.summary.total_tokens_saved || 0}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.label}>运行天数</span>
              <span className={styles.value}>{stats?.summary.running_days || 0} 天</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.label}>运行时长</span>
              <span className={styles.value}>
                {stats?.summary.running_hours ? `${stats.summary.running_hours.toFixed(1)} 小时` : '0 小时'}
              </span>
            </div>
          </div>
        </div>

        {/* 最近一次运行 */}
        {stats?.latest && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>最近一次运行</h4>
            <div className={styles.latestInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>开始时间:</span>
                <span className={styles.value}>{formatTime(stats.latest.started_at)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>状态:</span>
                <span className={`${styles.value} ${styles[stats.latest.status]}`}>
                  {stats.latest.status === 'success' ? '✅ 成功' : '❌ 失败'}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>执行链:</span>
                <span className={styles.value}>{stats.latest.chain || '-'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>耗时:</span>
                <span className={styles.value}>{formatDuration(stats.latest.duration_seconds)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>抓取币种:</span>
                <span className={styles.value}>{stats.latest.tokens_saved || 0} 个</span>
              </div>
              {stats.latest.error_message && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>错误信息:</span>
                  <span className={`${styles.value} ${styles.error}`}>{stats.latest.error_message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 历史记录 */}
        {stats?.history && stats.history.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>历史记录 (最近10次)</h4>
            <div className={styles.historyTable}>
              <table>
                <thead>
                  <tr>
                    <th>开始时间</th>
                    <th>状态</th>
                    <th>耗时</th>
                    <th>币种数</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.history.map((record, index) => (
                    <tr key={index}>
                      <td>{formatTime(record.started_at)}</td>
                      <td>
                        <span className={`${styles.status} ${styles[record.status]}`}>
                          {record.status === 'success' ? '✅' : '❌'}
                        </span>
                      </td>
                      <td>{formatDuration(record.duration_seconds)}</td>
                      <td>{record.tokens_saved || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScraperStats;
