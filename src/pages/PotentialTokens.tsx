import React, { useState, useEffect } from 'react';
import styles from './PotentialTokens.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar } from '../components/ui';
import ScraperConfig from '../components/blockchain/ScraperConfig';
import { blockchainAPI } from '../services/blockchainAPI';
import type { PotentialToken } from '../types/blockchain';

interface Props {
  isSidebarCollapsed?: boolean;
}

type SortField = 'price_ath_usd' | 'scraped_timestamp' | 'market_cap_at_scrape' | 'price_change_24h_at_scrape' | 'current_price_usd' | 'volume_24h_at_scrape' | 'liquidity_at_scrape' | 'token_created_at';
type SortOrder = 'asc' | 'desc';

const PotentialTokens: React.FC<Props> = ({ isSidebarCollapsed }) => {
  const [tokens, setTokens] = useState<PotentialToken[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyNotAdded, setOnlyNotAdded] = useState(true);
  const [deletingTokenId, setDeletingTokenId] = useState<string | null>(null);

  // 排序和筛选状态（默认按涨幅降序排序）
  const [sortField, setSortField] = useState<SortField | null>('price_change_24h_at_scrape');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedChain, setSelectedChain] = useState<string>('all');

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await blockchainAPI.getPotentialTokens({
        limit: 100,
        only_not_added: onlyNotAdded
      });
      setTokens(response.data);
      setTotal(response.total);
    } catch (err: any) {
      console.error('获取潜力代币列表失败:', err);
      setError(err.message || '获取潜力代币列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [onlyNotAdded]);

  // 格式化价格
  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) {
      return '-';
    }
    if (price >= 1) {
      return `$${price.toFixed(4)}`;
    }
    return `$${price.toFixed(8)}`;
  };

  // 格式化时间
  const formatTime = (timestamp: number | string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 格式化大数值（K/M）
  const formatLargeNumber = (value: number | null): string => {
    if (value === null || value === undefined) {
      return '-';
    }

    // 大于等于1,000,000显示为M
    if (value >= 1000000) {
      return `$${(value / 1000000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
    }

    // 大于等于1,000显示为K
    if (value >= 1000) {
      return `$${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })}K`;
    }

    // 小于1,000直接显示
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };

  // 添加到监控
  const handleAddToMonitor = async (tokenId: string, symbol: string) => {
    if (!confirm(`确定要添加 ${symbol} 到监控列表吗？`)) {
      return;
    }

    try {
      await blockchainAPI.addToMonitor({
        potential_token_id: tokenId,
        drop_threshold_percent: 20.0 // 默认跌幅阈值20%
      });
      alert(`✅ ${symbol} 已添加到监控列表`);
      fetchTokens(); // 刷新列表
    } catch (err: any) {
      console.error('添加到监控失败:', err);
      alert(`❌ 添加失败: ${err.message}`);
    }
  };

  // 删除潜力代币
  const handleDelete = async (tokenId: string, symbol: string) => {
    try {
      setDeletingTokenId(tokenId);
      await blockchainAPI.deletePotentialToken(tokenId);
      fetchTokens(); // 刷新列表
    } catch (err: any) {
      console.error('删除失败:', err);
      alert(`❌ 删除失败: ${err.message}`);
    } finally {
      setDeletingTokenId(null);
    }
  };

  // 处理排序
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 切换排序顺序
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 新字段，默认降序
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 筛选和排序后的代币列表
  const filteredAndSortedTokens = React.useMemo(() => {
    let result = [...tokens];

    // 链筛选
    if (selectedChain !== 'all') {
      result = result.filter(token => token.chain === selectedChain);
    }

    // 排序
    if (sortField) {
      result.sort((a, b) => {
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

        // 处理null/undefined值
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // 对于数值字段，强制转换为数字进行比较
        const numericFields: SortField[] = [
          'price_ath_usd',
          'market_cap_at_scrape',
          'price_change_24h_at_scrape',
          'current_price_usd',
          'volume_24h_at_scrape',
          'liquidity_at_scrape'
        ];

        if (numericFields.includes(sortField)) {
          // 强制转换为数字，确保数值比较
          const aNum = typeof aValue === 'number' ? aValue : parseFloat(String(aValue));
          const bNum = typeof bValue === 'number' ? bValue : parseFloat(String(bValue));

          // 处理NaN
          if (isNaN(aNum) && isNaN(bNum)) return 0;
          if (isNaN(aNum)) return 1;
          if (isNaN(bNum)) return -1;

          // 数值比较
          return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // 字符串/日期比较
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tokens, selectedChain, sortField, sortOrder]);

  // 排序图标
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={loading} progress={loading ? 50 : 100} absolute />

      <PageHeader
        title="潜力币种列表"
        subtitle="发现和筛选具有潜力的代币"
        icon="🔍"
      >
        <div className={styles.summary}>
          共 <strong>{total}</strong> 个潜力代币
          <button onClick={fetchTokens} className={styles.refreshBtn} style={{ marginLeft: '1rem' }}>
            🔄 刷新
          </button>
        </div>
      </PageHeader>

      <div className={styles.content}>
        {/* 爬虫配置 */}
        <ScraperConfig />

        {/* 筛选器 */}
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            <input
              type="checkbox"
              checked={onlyNotAdded}
              onChange={(e) => setOnlyNotAdded(e.target.checked)}
            />
            <span>只显示未添加到监控的代币</span>
          </label>

          <div className={styles.chainRadioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="chain"
                value="all"
                checked={selectedChain === 'all'}
                onChange={(e) => setSelectedChain(e.target.value)}
              />
              <span>所有链</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="chain"
                value="bsc"
                checked={selectedChain === 'bsc'}
                onChange={(e) => setSelectedChain(e.target.value)}
              />
              <span>BSC</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="chain"
                value="solana"
                checked={selectedChain === 'solana'}
                onChange={(e) => setSelectedChain(e.target.value)}
              />
              <span>Solana</span>
            </label>
          </div>

          <div className={styles.filterInfo}>
            显示 <strong>{filteredAndSortedTokens.length}</strong> / {tokens.length} 个代币
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className={styles.loading}>
            <p>⏳ 加载中...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className={styles.error}>
            <p>❌ {error}</p>
            <button onClick={fetchTokens} className={styles.retryBtn}>重试</button>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && tokens.length === 0 && (
          <div className={styles.empty}>
            <p>📭 暂无潜力代币</p>
          </div>
        )}

        {/* 代币列表 - 移动端卡片视图 */}
        {!loading && !error && tokens.length > 0 && (
          <div className={styles.mobileCards}>
            {filteredAndSortedTokens.map((token) => (
              <div key={token.id} className={styles.tokenCard}>
                {/* 卡片头部 - 符号和链 */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    {token.pair_address ? (
                      <a
                        href={`https://dexscreener.com/${token.chain.toLowerCase() === 'solana' ? 'solana' : 'bsc'}/${token.pair_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.symbolLink}
                      >
                        {token.token_symbol}
                      </a>
                    ) : (
                      <span className={styles.symbol}>{token.token_symbol}</span>
                    )}
                    <span className={styles.chainBadge}>{token.chain}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.addBtn}
                      onClick={() => handleAddToMonitor(token.id, token.token_symbol)}
                    >
                      ➕
                    </button>
                    <button
                      className={`${styles.deleteBtn} ${deletingTokenId === token.id ? styles.deleting : ''}`}
                      onClick={() => handleDelete(token.id, token.token_symbol)}
                      disabled={deletingTokenId === token.id}
                    >
                      {deletingTokenId === token.id ? (
                        <span className={styles.spinner}></span>
                      ) : (
                        '🗑️'
                      )}
                    </button>
                  </div>
                </div>

                {/* 卡片内容 - 数据字段（两列布局）*/}
                <div className={styles.cardBody}>
                  <div className={styles.cardGrid}>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>历史最高</span>
                      <span className={styles.value}>{formatPrice(token.price_ath_usd)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>当前价格</span>
                      <span className={styles.value}>{formatPrice(token.current_price_usd)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>24h涨跌</span>
                      <span className={styles.value}>
                        {token.price_change_24h_at_scrape !== null && token.price_change_24h_at_scrape !== undefined ? (
                          <span className={token.price_change_24h_at_scrape >= 0 ? styles.priceUp : styles.priceDown}>
                            {token.price_change_24h_at_scrape >= 0 ? '↑' : '↓'} {Math.abs(token.price_change_24h_at_scrape).toFixed(2)}%
                          </span>
                        ) : '-'}
                      </span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>市值</span>
                      <span className={styles.value}>{formatLargeNumber(token.market_cap_at_scrape)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>成交量</span>
                      <span className={styles.value}>{formatLargeNumber(token.volume_24h)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>流动性</span>
                      <span className={styles.value}>{formatLargeNumber(token.current_tvl)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>买/卖</span>
                      <span className={styles.value}>
                        <span className={styles.priceUp}>{token.buys_24h || 0}</span>/<span className={styles.priceDown}>{token.sells_24h || 0}</span>
                      </span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>创建时间</span>
                      <span className={styles.valueSmall}>
                        {token.token_created_at ? formatTime(token.token_created_at).split(' ')[0] : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 代币列表 - 桌面端表格视图 */}
        {!loading && !error && tokens.length > 0 && (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>符号</th>
                  <th>链</th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('price_ath_usd')}
                  >
                    历史最高 {getSortIcon('price_ath_usd')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('scraped_timestamp')}
                  >
                    抓取时间 {getSortIcon('scraped_timestamp')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('market_cap_at_scrape')}
                  >
                    抓取时市值 {getSortIcon('market_cap_at_scrape')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('price_change_24h_at_scrape')}
                  >
                    抓取时涨跌 {getSortIcon('price_change_24h_at_scrape')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('current_price_usd')}
                  >
                    当前价格 {getSortIcon('current_price_usd')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('volume_24h_at_scrape')}
                  >
                    24小时成交量 {getSortIcon('volume_24h_at_scrape')}
                  </th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('liquidity_at_scrape')}
                  >
                    流动性 {getSortIcon('liquidity_at_scrape')}
                  </th>
                  <th>24小时买卖</th>
                  <th
                    className={styles.sortable}
                    onClick={() => handleSort('token_created_at')}
                  >
                    创建时间 {getSortIcon('token_created_at')}
                  </th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTokens.map((token) => (
                  <tr key={token.id}>
                    {/* 符号 */}
                    <td>
                      {token.pair_address ? (
                        <a
                          href={`https://dexscreener.com/${token.chain.toLowerCase() === 'solana' ? 'solana' : 'bsc'}/${token.pair_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.symbolLink}
                          title={`查看 ${token.token_symbol} 在 DexScreener`}
                        >
                          {token.token_symbol}
                        </a>
                      ) : (
                        <span className={styles.symbol}>{token.token_symbol}</span>
                      )}
                    </td>

                    {/* 链 */}
                    <td className={styles.chain}>{token.chain}</td>

                    {/* 历史最高 */}
                    <td className={styles.price}>{formatPrice(token.price_ath_usd)}</td>

                    {/* 抓取时间 */}
                    <td className={styles.time}>
                      {token.scraped_timestamp ? formatTime(token.scraped_timestamp) : '-'}
                    </td>

                    {/* 抓取时市值 */}
                    <td className={styles.marketCap}>
                      {formatLargeNumber(token.market_cap_at_scrape)}
                    </td>

                    {/* 抓取时涨跌 */}
                    <td>
                      {token.price_change_24h_at_scrape !== null && token.price_change_24h_at_scrape !== undefined ? (
                        <span className={token.price_change_24h_at_scrape >= 0 ? styles.priceUp : styles.priceDown}>
                          {token.price_change_24h_at_scrape >= 0 ? '↑' : '↓'} {Math.abs(token.price_change_24h_at_scrape).toFixed(2)}%
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* 当前价格 */}
                    <td className={styles.price}>{formatPrice(token.current_price_usd)}</td>

                    {/* 24小时成交量 */}
                    <td className={styles.volume}>
                      {formatLargeNumber(token.volume_24h)}
                    </td>

                    {/* 流动性 */}
                    <td className={styles.liquidity}>
                      {formatLargeNumber(token.current_tvl)}
                    </td>

                    {/* 24小时买卖 */}
                    <td className={styles.txns}>
                      <span className={styles.priceUp}>{token.buys_24h || 0}</span> /
                      <span className={styles.priceDown}> {token.sells_24h || 0}</span>
                    </td>

                    {/* 创建时间 */}
                    <td className={styles.time}>
                      {token.token_created_at ? formatTime(token.token_created_at) : '-'}
                    </td>

                    {/* 操作 */}
                    <td className={styles.actions}>
                      <button
                        className={styles.addBtn}
                        onClick={() => handleAddToMonitor(token.id, token.token_symbol)}
                        title="添加到监控"
                      >
                        ➕ 添加
                      </button>
                      <button
                        className={`${styles.deleteBtn} ${deletingTokenId === token.id ? styles.deleting : ''}`}
                        onClick={() => handleDelete(token.id, token.token_symbol)}
                        disabled={deletingTokenId === token.id}
                        title={deletingTokenId === token.id ? '删除中...' : '删除'}
                      >
                        {deletingTokenId === token.id ? (
                          <span className={styles.spinner}></span>
                        ) : (
                          '🗑️'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PotentialTokens;
