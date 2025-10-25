import React, { useState, useEffect } from 'react';
import styles from './DeletedTokens.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar } from '../components/ui';
import { blockchainAPI } from '../services/blockchainAPI';
import type { PotentialToken, MonitorToken } from '../types/blockchain';

interface Props {
  isSidebarCollapsed?: boolean;
}

const DeletedTokens: React.FC<Props> = ({ isSidebarCollapsed }) => {
  // 潜力代币状态
  const [potentialTokens, setPotentialTokens] = useState<PotentialToken[]>([]);
  const [potentialTotal, setPotentialTotal] = useState(0);
  const [potentialLoading, setPotentialLoading] = useState(true);

  // 监控代币状态
  const [monitorTokens, setMonitorTokens] = useState<MonitorToken[]>([]);
  const [monitorTotal, setMonitorTotal] = useState(0);
  const [monitorLoading, setMonitorLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // 获取已删除的潜力代币
  const fetchPotentialTokens = async () => {
    try {
      setPotentialLoading(true);
      const response = await blockchainAPI.getDeletedPotentialTokens({ limit: 100 });
      setPotentialTokens(response.data);
      setPotentialTotal(response.total);
    } catch (err: any) {
      console.error('获取已删除潜力代币失败:', err);
      setError(err.message);
    } finally {
      setPotentialLoading(false);
    }
  };

  // 获取已删除的监控代币
  const fetchMonitorTokens = async () => {
    try {
      setMonitorLoading(true);
      const response = await blockchainAPI.getDeletedMonitorTokens({ limit: 100 });
      setMonitorTokens(response.data);
      setMonitorTotal(response.total);
    } catch (err: any) {
      console.error('获取已删除监控代币失败:', err);
      setError(err.message);
    } finally {
      setMonitorLoading(false);
    }
  };

  useEffect(() => {
    fetchPotentialTokens();
    fetchMonitorTokens();
  }, []);

  // 格式化价格
  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) return '-';
    if (price >= 1) return `$${price.toFixed(4)}`;
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

  // 格式化市值
  const formatMarketCap = (value: number | null): string => {
    if (value === null || value === undefined) return '-';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // 恢复潜力代币
  const handleRestorePotential = async (tokenId: string) => {
    try {
      await blockchainAPI.restorePotentialToken(tokenId);
      fetchPotentialTokens();
    } catch (err: any) {
      console.error('恢复失败:', err);
      alert(`❌ 恢复失败: ${err.message}`);
    }
  };

  // 恢复监控代币
  const handleRestoreMonitor = async (tokenId: string) => {
    try {
      await blockchainAPI.restoreMonitorToken(tokenId);
      fetchMonitorTokens();
    } catch (err: any) {
      console.error('恢复失败:', err);
      alert(`❌ 恢复失败: ${err.message}`);
    }
  };

  // 彻底删除潜力代币
  const handlePermanentDeletePotential = async (tokenId: string, tokenSymbol: string) => {
    if (!confirm(`⚠️ 确认彻底删除 ${tokenSymbol}？此操作不可恢复！`)) {
      return;
    }

    try {
      await blockchainAPI.permanentDeletePotentialToken(tokenId);
      alert('✅ 彻底删除成功');
      fetchPotentialTokens();
    } catch (err: any) {
      console.error('彻底删除失败:', err);
      alert(`❌ 彻底删除失败: ${err.message}`);
    }
  };

  // 彻底删除监控代币
  const handlePermanentDeleteMonitor = async (tokenId: string, tokenSymbol: string) => {
    if (!confirm(`⚠️ 确认彻底删除 ${tokenSymbol}？此操作不可恢复！`)) {
      return;
    }

    try {
      await blockchainAPI.permanentDeleteMonitorToken(tokenId);
      alert('✅ 彻底删除成功');
      fetchMonitorTokens();
    } catch (err: any) {
      console.error('彻底删除失败:', err);
      alert(`❌ 彻底删除失败: ${err.message}`);
    }
  };

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={potentialLoading || monitorLoading} progress={(potentialLoading || monitorLoading) ? 50 : 100} absolute />

      <PageHeader
        title="已删除代币"
        subtitle="查看和恢复已删除的潜力代币和监控代币"
        icon="🗑️"
      >
        <div className={styles.summary}>
          潜力代币: <strong>{potentialTotal}</strong> | 监控代币: <strong>{monitorTotal}</strong>
          <button
            onClick={() => { fetchPotentialTokens(); fetchMonitorTokens(); }}
            className={styles.refreshBtn}
            style={{ marginLeft: '1rem' }}
          >
            🔄 刷新
          </button>
        </div>
      </PageHeader>

      <div className={styles.content}>
        {error && (
          <div className={styles.error}>
            <p>❌ {error}</p>
          </div>
        )}

        <div className={styles.twoColumns}>
          {/* 左侧：已删除的潜力代币 */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <h3>已删除的潜力代币</h3>
              <span className={styles.count}>{potentialTotal}</span>
            </div>

            {potentialLoading && (
              <div className={styles.loading}>
                <p>⏳ 加载中...</p>
              </div>
            )}

            {!potentialLoading && potentialTokens.length === 0 && (
              <div className={styles.empty}>
                <p>📭 暂无已删除的潜力代币</p>
              </div>
            )}

            {/* 移动端卡片视图 - 潜力代币 */}
            {!potentialLoading && potentialTokens.length > 0 && (
              <div className={styles.mobileCards}>
                {potentialTokens.map((token) => (
                  <div key={token.id} className={styles.tokenCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>
                        <a
                          href={`https://dexscreener.com/${token.chain.toLowerCase() === 'solana' ? 'solana' : 'bsc'}/${token.pair_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.symbolLink}
                        >
                          {token.token_symbol}
                        </a>
                        <span className={styles.chainBadge}>{token.chain}</span>
                      </div>
                      <div className={styles.cardActions}>
                        <button
                          onClick={() => handleRestorePotential(token.id)}
                          className={styles.restoreBtn}
                        >
                          🔄
                        </button>
                        <button
                          onClick={() => handlePermanentDeletePotential(token.id, token.token_symbol)}
                          className={styles.permanentDeleteBtn}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardGrid}>
                        <div className={styles.cardItem}>
                          <span className={styles.label}>抓取价格</span>
                          <span className={styles.value}>{formatPrice(token.scraped_price_usd)}</span>
                        </div>
                        <div className={styles.cardItem}>
                          <span className={styles.label}>抓取时间</span>
                          <span className={styles.valueSmall}>{formatTime(token.scraped_timestamp).split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 桌面端表格视图 - 潜力代币 */}
            {!potentialLoading && potentialTokens.length > 0 && (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>符号</th>
                      <th>链</th>
                      <th>抓取价格</th>
                      <th>抓取时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {potentialTokens.map((token) => (
                      <tr key={token.id}>
                        <td>
                          <a
                            href={`https://dexscreener.com/${token.chain.toLowerCase() === 'solana' ? 'solana' : 'bsc'}/${token.pair_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.symbolLink}
                          >
                            {token.token_symbol}
                          </a>
                        </td>
                        <td className={styles.chain}>{token.chain}</td>
                        <td className={styles.price}>{formatPrice(token.scraped_price_usd)}</td>
                        <td className={styles.time}>{formatTime(token.scraped_timestamp)}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button
                              onClick={() => handleRestorePotential(token.id)}
                              className={styles.restoreBtn}
                            >
                              🔄 恢复
                            </button>
                            <button
                              onClick={() => handlePermanentDeletePotential(token.id, token.token_symbol)}
                              className={styles.permanentDeleteBtn}
                            >
                              🗑️ 彻底删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 右侧：已删除的监控代币 */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <h3>已删除的监控代币</h3>
              <span className={styles.count}>{monitorTotal}</span>
            </div>

            {monitorLoading && (
              <div className={styles.loading}>
                <p>⏳ 加载中...</p>
              </div>
            )}

            {!monitorLoading && monitorTokens.length === 0 && (
              <div className={styles.empty}>
                <p>📭 暂无已删除的监控代币</p>
              </div>
            )}

            {/* 移动端卡片视图 - 监控代币 */}
            {!monitorLoading && monitorTokens.length > 0 && (
              <div className={styles.mobileCards}>
                {monitorTokens.map((token) => (
                  <div key={token.id} className={styles.tokenCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>
                        <a
                          href={`https://dexscreener.com/${token.chain.toLowerCase() === 'solana' ? 'solana' : 'bsc'}/${token.pair_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.symbolLink}
                        >
                          {token.token_symbol}
                        </a>
                        <span className={styles.chainBadge}>{token.chain}</span>
                      </div>
                      <div className={styles.cardActions}>
                        <button
                          onClick={() => handleRestoreMonitor(token.id)}
                          className={styles.restoreBtn}
                        >
                          🔄
                        </button>
                        <button
                          onClick={() => handlePermanentDeleteMonitor(token.id, token.token_symbol)}
                          className={styles.permanentDeleteBtn}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardGrid}>
                        <div className={styles.cardItem}>
                          <span className={styles.label}>当前价格</span>
                          <span className={styles.value}>{formatPrice(token.current_price_usd)}</span>
                        </div>
                        <div className={styles.cardItem}>
                          <span className={styles.label}>市值</span>
                          <span className={styles.value}>{formatMarketCap(token.current_market_cap)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 桌面端表格视图 - 监控代币 */}
            {!monitorLoading && monitorTokens.length > 0 && (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>符号</th>
                      <th>链</th>
                      <th>当前价格</th>
                      <th>市值</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitorTokens.map((token) => (
                      <tr key={token.id}>
                        <td>
                          <a
                            href={`https://dexscreener.com/${token.chain.toLowerCase() === 'solana' ? 'solana' : 'bsc'}/${token.pair_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.symbolLink}
                          >
                            {token.token_symbol}
                          </a>
                        </td>
                        <td className={styles.chain}>{token.chain}</td>
                        <td className={styles.price}>{formatPrice(token.current_price_usd)}</td>
                        <td className={styles.marketCap}>{formatMarketCap(token.current_market_cap)}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button
                              onClick={() => handleRestoreMonitor(token.id)}
                              className={styles.restoreBtn}
                            >
                              🔄 恢复
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteMonitor(token.id, token.token_symbol)}
                              className={styles.permanentDeleteBtn}
                            >
                              🗑️ 彻底删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeletedTokens;
