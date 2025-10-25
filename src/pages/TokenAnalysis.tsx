import React, { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { priceAnalysisAPI } from '../services/priceAnalysisAPI';
import type { PriceSwing, TokenSwingStats } from '../types/blockchain';
import styles from './TokenAnalysis.module.scss';

interface Props {
  isSidebarCollapsed?: boolean;
}

const TokenAnalysis: React.FC<Props> = ({ isSidebarCollapsed }) => {
  // 从URL获取symbol参数
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const symbolParam = urlParams.get('symbol') || '';

  const [symbol, setSymbol] = useState<string>(symbolParam);
  const [stats, setStats] = useState<TokenSwingStats | null>(null);
  const [swings, setSwings] = useState<PriceSwing[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [swingFilter, setSwingFilter] = useState<'all' | 'rise' | 'fall'>('all');

  // 获取代币数据
  const fetchTokenData = async (tokenSymbol: string) => {
    if (!tokenSymbol.trim()) {
      setError('请输入代币符号');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 并行请求数据
      const [swingsResponse, statsResponse] = await Promise.all([
        priceAnalysisAPI.getTokenPriceSwings(undefined, tokenSymbol, {
          page: 1,
          page_size: 100,
          sort_by: 'start_time',
          sort_order: 'desc'
        }),
        priceAnalysisAPI.getTokenSwingStats({
          page: 1,
          page_size: 100 // 获取足够多的数据以查找目标token
        })
      ]);

      // 设置波动记录
      setSwings(swingsResponse.data);

      // 从统计列表中找到对应symbol的数据
      const tokenStats = statsResponse.data.find(s => s.token_symbol === tokenSymbol);
      setStats(tokenStats || null);

      if (swingsResponse.data.length === 0 && !tokenStats) {
        setError(`未找到代币 ${tokenSymbol} 的分析数据`);
      }
    } catch (err) {
      console.error('获取代币分析数据失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时如果有symbol参数则自动查询
  useEffect(() => {
    if (symbolParam) {
      fetchTokenData(symbolParam);
    }
  }, [symbolParam]);

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTokenData(symbol);
  };

  // 格式化价格
  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
  };

  // 格式化时间
  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 过滤波动记录
  const filteredSwings = swings.filter(swing => {
    if (swingFilter === 'all') return true;
    return swing.swing_type === swingFilter;
  });

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="代币价格波动分析"
        subtitle="查看代币历史价格波动记录和统计信息"
        icon="📊"
      />

      <div className={styles.content}>
        {/* 搜索栏 */}
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            placeholder="输入代币符号（如 BTC, ETH, COAI）..."
            className={styles.searchInput}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
          <button type="submit" className={styles.searchBtn} disabled={loading}>
            {loading ? '查询中...' : '🔍 查询'}
          </button>
        </form>

        {/* 错误提示 */}
        {error && (
          <div className={styles.error}>
            <p>❌ {error}</p>
          </div>
        )}

        {/* 统计卡片 */}
        {stats && (
          <div className={styles.statsCard}>
            <div className={styles.statsHeader}>
              <h3>{stats.token_symbol}</h3>
              <span className={styles.tokenName}>{stats.token_name}</span>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>总波动次数</div>
                <div className={styles.statValue}>{stats.total_swings}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>上涨次数</div>
                <div className={`${styles.statValue} ${styles.rise}`}>{stats.rises}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>下跌次数</div>
                <div className={`${styles.statValue} ${styles.fall}`}>{stats.falls}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>最大涨幅</div>
                <div className={`${styles.statValue} ${styles.rise}`}>+{stats.max_rise_pct.toFixed(2)}%</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>最大跌幅</div>
                <div className={`${styles.statValue} ${styles.fall}`}>{stats.max_fall_pct.toFixed(2)}%</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>平均持续时长</div>
                <div className={styles.statValue}>{stats.avg_duration_hours.toFixed(1)}h</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>当前价格</div>
                <div className={styles.statValue}>{formatPrice(stats.current_price)}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>流动性</div>
                <div className={styles.statValue}>
                  ${(stats.liquidity_usd / 1000000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>市值</div>
                <div className={styles.statValue}>
                  ${(stats.market_cap / 1000000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 波动记录 */}
        {swings.length > 0 && (
          <div className={styles.swingsSection}>
            {/* 过滤器 */}
            <div className={styles.filterBtns}>
              <button
                className={`${styles.filterBtn} ${swingFilter === 'all' ? styles.active : ''}`}
                onClick={() => setSwingFilter('all')}
              >
                全部 ({swings.length})
              </button>
              <button
                className={`${styles.filterBtn} ${swingFilter === 'rise' ? styles.active : ''}`}
                onClick={() => setSwingFilter('rise')}
              >
                上涨 ({swings.filter(s => s.swing_type === 'rise').length})
              </button>
              <button
                className={`${styles.filterBtn} ${swingFilter === 'fall' ? styles.active : ''}`}
                onClick={() => setSwingFilter('fall')}
              >
                下跌 ({swings.filter(s => s.swing_type === 'fall').length})
              </button>
            </div>

            {/* 波动表格 */}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>涨跌幅</th>
                    <th>起始价格</th>
                    <th>结束价格</th>
                    <th>持续时长</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>周期</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSwings.map((swing) => (
                    <tr key={swing.id}>
                      <td>
                        <span className={`${styles.swingType} ${styles[swing.swing_type]}`}>
                          {swing.swing_type === 'rise' ? '📈 上涨' : '📉 下跌'}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.swingPct} ${styles[swing.swing_type]}`}>
                          {swing.swing_type === 'rise' ? '+' : ''}{swing.swing_pct.toFixed(2)}%
                        </span>
                      </td>
                      <td className={styles.price}>{formatPrice(swing.start_price)}</td>
                      <td className={styles.price}>{formatPrice(swing.end_price)}</td>
                      <td>{swing.duration_hours.toFixed(1)}h</td>
                      <td className={styles.time}>{formatTime(swing.start_time)}</td>
                      <td className={styles.time}>{formatTime(swing.end_time)}</td>
                      <td>
                        <span className={styles.badge}>{swing.timeframe}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && swings.length === 0 && !stats && (
          <div className={styles.empty}>
            <p>💡 输入代币符号开始分析</p>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>正在加载数据...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenAnalysis;
