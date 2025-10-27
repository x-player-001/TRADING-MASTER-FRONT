import React, { useState, useEffect } from 'react';
import styles from './MonitorTokens.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar } from '../components/ui';
import AddMonitorToken from '../components/blockchain/AddMonitorToken';
import { blockchainAPI } from '../services/blockchainAPI';
import type { MonitorToken, PriceAlert } from '../types/blockchain';

interface Props {
  isSidebarCollapsed?: boolean;
}

const MonitorTokens: React.FC<Props> = ({ isSidebarCollapsed }) => {
  const [tokens, setTokens] = useState<MonitorToken[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 价格报警状态
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  // 编辑阈值状态
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editingThresholds, setEditingThresholds] = useState<string>('');
  const [deletingTokenId, setDeletingTokenId] = useState<string | null>(null);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError(null);

      // 使用监控代币接口
      const response = await blockchainAPI.getMonitorTokens({
        limit: 100
      });
      setTokens(response.data);
      setTotal(response.total);
    } catch (err: any) {
      console.error('获取监控代币列表失败:', err);
      setError(err.message || '获取监控代币列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      setAlertsLoading(true);
      const response = await blockchainAPI.getPriceAlerts({
        limit: 10,
        acknowledged: showAcknowledged ? null : false,
        severity: selectedSeverity
      });
      setAlerts(response.data);
      setAlertsTotal(response.total);
    } catch (err: any) {
      console.error('获取价格报警失败:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  // 开始编辑阈值
  const handleStartEditThresholds = (tokenId: string, currentThresholds: number[]) => {
    setEditingTokenId(tokenId);
    setEditingThresholds(currentThresholds.join(', '));
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingTokenId(null);
    setEditingThresholds('');
  };

  // 保存阈值
  const handleSaveThresholds = async (tokenId: string) => {
    try {
      // 解析输入的阈值
      const thresholdsArray = editingThresholds
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '')
        .map(s => parseFloat(s))
        .filter(n => !isNaN(n) && n > 0 && n <= 100);

      if (thresholdsArray.length === 0) {
        alert('请输入有效的阈值（0-100之间的数字，用逗号分隔）');
        return;
      }

      // 排序阈值
      thresholdsArray.sort((a, b) => a - b);

      await blockchainAPI.updateMonitorTokenThresholds(tokenId, thresholdsArray);
      alert('✅ 阈值更新成功');

      setEditingTokenId(null);
      setEditingThresholds('');
      fetchTokens(); // 刷新列表
    } catch (err: any) {
      console.error('更新阈值失败:', err);
      alert(`❌ 更新失败: ${err.message}`);
    }
  };

  // 删除监控代币
  const handleDelete = async (tokenId: string) => {
    try {
      setDeletingTokenId(tokenId);
      await blockchainAPI.deleteMonitorToken(tokenId);
      fetchTokens(); // 刷新列表
    } catch (err: any) {
      console.error('删除失败:', err);
      alert(`❌ 删除失败: ${err.message}`);
    } finally {
      setDeletingTokenId(null);
    }
  };

  useEffect(() => {
    fetchTokens();
    fetchAlerts();
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [selectedSeverity, showAcknowledged]);

  // 格式化价格（优化小数显示）
  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) {
      return '-';
    }

    // 大于等于1，保留4位小数
    if (price >= 1) {
      return `$${price.toFixed(4)}`;
    }

    // 小于1，找到第一个非0数字后保留3位
    const priceStr = price.toString();
    const decimalPart = priceStr.split('.')[1] || '';

    // 找到第一个非0数字的位置
    let firstNonZeroIndex = -1;
    for (let i = 0; i < decimalPart.length; i++) {
      if (decimalPart[i] !== '0') {
        firstNonZeroIndex = i;
        break;
      }
    }

    if (firstNonZeroIndex === -1) {
      return '$0';
    }

    // 第一个非0数字后保留3位，总共保留firstNonZeroIndex + 3位小数
    const decimals = firstNonZeroIndex + 3;
    return `$${price.toFixed(decimals)}`;
  };

  // 格式化时间
  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
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

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={loading || alertsLoading} progress={(loading || alertsLoading) ? 50 : 100} absolute />

      <PageHeader
        title="监控代币列表"
        subtitle="实时监控的代币数据和价格变化"
        icon="👁️"
      >
        <div className={styles.summary}>
          监控中: <strong>{total}</strong> 个代币
          <button onClick={fetchTokens} className={styles.refreshBtn} style={{ marginLeft: '1rem' }}>
            🔄 刷新
          </button>
        </div>
      </PageHeader>

      <div className={styles.content}>
        {/* 手动添加监控 */}
        <div className={styles.addMonitorSection}>
          <AddMonitorToken onSuccess={fetchTokens} />
        </div>

        {/* 价格报警模块 */}
        <div className={styles.alertsSection}>
          <div className={styles.alertsHeader}>
            <div className={styles.alertsTitle}>
              <span className={styles.alertIcon}>🚨</span>
              <h3>价格报警</h3>
              {alertsTotal > 0 && <span className={styles.alertBadge}>{alertsTotal}</span>}
            </div>
              <div className={styles.alertsFilters}>
                <button
                  className={`${styles.filterBtn} ${selectedSeverity === null ? styles.active : ''}`}
                  onClick={() => setSelectedSeverity(null)}
                >
                  全部
                </button>
                <button
                  className={`${styles.filterBtn} ${styles.critical} ${selectedSeverity === 'critical' ? styles.active : ''}`}
                  onClick={() => setSelectedSeverity('critical')}
                >
                  严重
                </button>
                <button
                  className={`${styles.filterBtn} ${styles.warning} ${selectedSeverity === 'warning' ? styles.active : ''}`}
                  onClick={() => setSelectedSeverity('warning')}
                >
                  警告
                </button>
                <button
                  className={`${styles.filterBtn} ${styles.info} ${selectedSeverity === 'info' ? styles.active : ''}`}
                  onClick={() => setSelectedSeverity('info')}
                >
                  信息
                </button>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showAcknowledged}
                    onChange={(e) => setShowAcknowledged(e.target.checked)}
                  />
                  显示已确认
                </label>
              </div>
            </div>
            <div className={styles.alertsList}>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`${styles.alertCard} ${styles[alert.severity]} ${alert.acknowledged ? styles.acknowledged : ''}`}
                >
                  <span className={styles.severityIcon}>
                    {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}
                  </span>
                  <span className={styles.tokenSymbol}>{alert.token_symbol}</span>
                  <span className={styles.alertType}>{alert.alert_type}</span>
                  <span className={styles.alertMetric}>
                    触发: {formatPrice(alert.trigger_price_usd)}
                  </span>
                  <span className={styles.alertMetric}>
                    峰值: {formatPrice(alert.peak_price_usd)}
                  </span>
                  <span className={styles.alertMetric}>
                    距峰值: <span className={styles.negative}>↓{alert.drop_from_peak_percent.toFixed(2)}%</span>
                  </span>
                  <span className={styles.alertTime}>{formatTime(alert.triggered_at)}</span>
                </div>
              ))}
            </div>

          {/* 空状态 */}
          {!alertsLoading && alerts.length === 0 && (
            <div className={styles.alertsEmpty}>
              <p>暂无价格报警</p>
            </div>
          )}
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
            <p>📭 暂无监控代币</p>
          </div>
        )}

        {/* 代币列表 - 移动端卡片视图 */}
        {!loading && !error && tokens.length > 0 && (
          <div className={styles.mobileCards}>
            {tokens.map((token) => (
              <div key={token.id} className={styles.tokenCard}>
                {/* 卡片头部 */}
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
                  <button
                    onClick={() => handleDelete(token.id)}
                    className={`${styles.deleteBtn} ${deletingTokenId === token.id ? styles.deleting : ''}`}
                    disabled={deletingTokenId === token.id}
                  >
                    <span className={deletingTokenId === token.id ? styles.spinning : ''}>
                      {deletingTokenId === token.id ? '🔄' : '🗑️'}
                    </span>
                  </button>
                </div>

                {/* 卡片内容（两列布局）*/}
                <div className={styles.cardBody}>
                  <div className={styles.cardGrid}>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>当前价格</span>
                      <span className={styles.value}>{formatPrice(token.current_price_usd)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>历史最高</span>
                      <span className={styles.value}>{formatPrice(token.price_ath_usd)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>距峰值</span>
                      <span className={styles.value}>
                        {token.drop_from_peak_percent !== null && token.drop_from_peak_percent !== undefined ? (
                          <span className={styles.priceDown}>
                            ↓ {token.drop_from_peak_percent.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>峰值倍数</span>
                      <span className={styles.value}>
                        {token.multiplier_to_peak !== null && token.multiplier_to_peak !== undefined ? (
                          <span className={styles.multiplier}>
                            {token.multiplier_to_peak.toFixed(2)}x
                          </span>
                        ) : '-'}
                      </span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>24h涨跌</span>
                      <span className={styles.value}>
                        {token.price_change_24h !== null && token.price_change_24h !== undefined ? (
                          <span className={token.price_change_24h >= 0 ? styles.priceUp : styles.priceDown}>
                            {token.price_change_24h >= 0 ? '↑' : '↓'} {Math.abs(token.price_change_24h).toFixed(2)}%
                          </span>
                        ) : '-'}
                      </span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>成交量</span>
                      <span className={styles.value}>{formatLargeNumber(token.volume_24h)}</span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>买/卖</span>
                      <span className={styles.value}>
                        <span className={styles.priceUp}>{token.buys_24h}</span>/<span className={styles.priceDown}>{token.sells_24h}</span>
                      </span>
                    </div>
                    <div className={styles.cardItem}>
                      <span className={styles.label}>创建时间</span>
                      <span className={styles.valueSmall}>
                        {token.token_created_at ? formatTime(token.token_created_at).split(' ')[0] : '-'}
                      </span>
                    </div>
                  </div>

                  {/* 报警阈值 - 移动端特殊处理 */}
                  <div className={styles.cardRowThreshold}>
                    <span className={styles.label}>报警阈值</span>
                    {editingTokenId === token.id ? (
                      <div className={styles.thresholdEditMobile}>
                        <input
                          type="text"
                          className={styles.thresholdInput}
                          value={editingThresholds}
                          onChange={(e) => setEditingThresholds(e.target.value)}
                          placeholder="例: 70, 80, 90"
                          autoFocus
                        />
                        <div className={styles.thresholdActions}>
                          <button
                            className={styles.saveBtn}
                            onClick={() => handleSaveThresholds(token.id)}
                          >
                            ✓ 保存
                          </button>
                          <button
                            className={styles.cancelBtn}
                            onClick={handleCancelEdit}
                          >
                            ✕ 取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.thresholdDisplayMobile}>
                        <div className={styles.thresholdTags}>
                          {token.alert_thresholds && token.alert_thresholds.length > 0 ? (
                            token.alert_thresholds.map((threshold, idx) => (
                              <span key={idx} className={styles.thresholdTag}>
                                {threshold}%
                              </span>
                            ))
                          ) : (
                            <span className={styles.noThreshold}>未设置</span>
                          )}
                        </div>
                        <button
                          className={styles.editThresholdBtn}
                          onClick={() => handleStartEditThresholds(token.id, token.alert_thresholds || [])}
                        >
                          ✏️ 编辑
                        </button>
                      </div>
                    )}
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
                  <th>当前价格</th>
                  <th>历史最高</th>
                  <th>距峰值跌幅</th>
                  <th>峰值倍数</th>
                  <th>报警阈值</th>
                  <th>24小时涨跌</th>
                  <th>24小时成交量</th>
                  <th>24小时买卖</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
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

                    {/* 当前价格 */}
                    <td className={styles.price}>{formatPrice(token.current_price_usd)}</td>

                    {/* 历史最高价 */}
                    <td className={styles.price}>{formatPrice(token.price_ath_usd)}</td>

                    {/* 距峰值跌幅 */}
                    <td>
                      {token.drop_from_peak_percent !== null && token.drop_from_peak_percent !== undefined ? (
                        <span className={styles.priceDown}>
                          ↓ {token.drop_from_peak_percent.toFixed(2)}%
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* 峰值倍数 */}
                    <td>
                      {token.multiplier_to_peak !== null && token.multiplier_to_peak !== undefined ? (
                        <span className={styles.multiplier}>
                          {token.multiplier_to_peak.toFixed(2)}x
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* 报警阈值 */}
                    <td className={styles.thresholdCell}>
                      {editingTokenId === token.id ? (
                        <div className={styles.thresholdEdit}>
                          <input
                            type="text"
                            className={styles.thresholdInput}
                            value={editingThresholds}
                            onChange={(e) => setEditingThresholds(e.target.value)}
                            placeholder="例: 70, 80, 90"
                            autoFocus
                          />
                          <div className={styles.thresholdActions}>
                            <button
                              className={styles.saveBtn}
                              onClick={() => handleSaveThresholds(token.id)}
                            >
                              ✓
                            </button>
                            <button
                              className={styles.cancelBtn}
                              onClick={handleCancelEdit}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.thresholdDisplay}>
                          <div className={styles.thresholdTags}>
                            {token.alert_thresholds && token.alert_thresholds.length > 0 ? (
                              token.alert_thresholds.map((threshold, idx) => (
                                <span key={idx} className={styles.thresholdTag}>
                                  {threshold}%
                                </span>
                              ))
                            ) : (
                              <span className={styles.noThreshold}>未设置</span>
                            )}
                          </div>
                          <button
                            className={styles.editThresholdBtn}
                            onClick={() => handleStartEditThresholds(token.id, token.alert_thresholds || [])}
                            title="编辑报警阈值"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>

                    {/* 24小时涨跌 */}
                    <td>
                      {token.price_change_24h !== null && token.price_change_24h !== undefined ? (
                        <span className={token.price_change_24h >= 0 ? styles.priceUp : styles.priceDown}>
                          {token.price_change_24h >= 0 ? '↑' : '↓'} {Math.abs(token.price_change_24h).toFixed(2)}%
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* 24小时成交量 */}
                    <td className={styles.volume}>
                      {formatLargeNumber(token.volume_24h)}
                    </td>

                    {/* 24小时买卖 */}
                    <td className={styles.txns}>
                      <span className={styles.priceUp}>{token.buys_24h}</span> /
                      <span className={styles.priceDown}> {token.sells_24h}</span>
                    </td>

                    {/* 创建时间 */}
                    <td className={styles.time}>
                      {token.token_created_at ? formatTime(token.token_created_at) : '-'}
                    </td>

                    {/* 操作 */}
                    <td>
                      <button
                        onClick={() => handleDelete(token.id)}
                        className={`${styles.deleteBtn} ${deletingTokenId === token.id ? styles.deleting : ''}`}
                        disabled={deletingTokenId === token.id}
                        title={deletingTokenId === token.id ? '删除中...' : '删除代币'}
                      >
                        <span className={deletingTokenId === token.id ? styles.spinning : ''}>
                          {deletingTokenId === token.id ? '🔄' : '🗑️'}
                        </span> 删除
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

export default MonitorTokens;
