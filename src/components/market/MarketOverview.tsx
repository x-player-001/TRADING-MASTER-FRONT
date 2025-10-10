import React from 'react';
import styles from './MarketOverview.module.scss';
import { formatCurrency, formatPercent, formatLargeNumber } from '../../utils/mockData';
import { useMarketData } from '../../hooks/useMarketData';

const MarketOverview: React.FC = () => {
  // 使用真实API数据，每60秒自动刷新
  const { data: marketData, loading, error } = useMarketData({
    limit: 10,
    autoRefresh: true,
    refreshInterval: 60000, // 60秒刷新一次
  });

  const getSymbolIcon = (symbol: string) => {
    const symbolMap: { [key: string]: string } = {
      'BTCUSDT': '₿',
      'ETHUSDT': 'Ξ',
      'BNBUSDT': 'BNB',
      'SOLUSDT': 'SOL',
      'ADAUSDT': 'ADA',
      'XRPUSDT': 'XRP',
      'DOGEUSDT': 'DOGE',
      'DOTUSDT': 'DOT',
      'AVAXUSDT': 'AVAX',
      'MATICUSDT': 'MATIC',
    };
    return symbolMap[symbol] || symbol.substring(0, 2);
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? '↗' : '↘';
  };

  // 加载状态
  if (loading && marketData.length === 0) {
    return (
      <div className={styles.container}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280',
          fontSize: '0.875rem'
        }}>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>⏳</div>
          正在加载市场数据...
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={styles.container}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#ef4444',
          fontSize: '0.875rem'
        }}>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>⚠️</div>
          加载市场数据失败
          <div style={{ marginTop: '0.5rem', opacity: 0.7 }}>
            {error.message}
          </div>
        </div>
      </div>
    );
  }

  // 无数据状态
  if (marketData.length === 0) {
    return (
      <div className={styles.container}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280',
          fontSize: '0.875rem'
        }}>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>📊</div>
          暂无市场数据
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>币种</th>
            <th>价格</th>
            <th>24h涨跌</th>
            <th>24h成交量</th>
            <th>24h最高</th>
            <th>24h最低</th>
          </tr>
        </thead>
        <tbody>
          {marketData.map((item, index) => (
            <tr key={index}>
              <td>
                <div className={styles.symbolCell}>
                  <div className={styles.symbolIcon}>
                    {getSymbolIcon(item.symbol)}
                  </div>
                  <div className={styles.symbolInfo}>
                    <div className={styles.symbolName}>
                      {item.symbol.replace('USDT', '')}/USDT
                    </div>
                    <div className={styles.symbolFullName}>
                      {item.displayName}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className={styles.price}>
                  {formatCurrency(item.price)}
                </div>
              </td>
              <td>
                <div className={`${styles.change} ${item.changePercent24h >= 0 ? styles.positive : styles.negative}`}>
                  <span className={styles.icon}>
                    {getChangeIcon(item.changePercent24h)}
                  </span>
                  {formatPercent(item.changePercent24h)}
                </div>
              </td>
              <td>
                <div className={styles.volume}>
                  ${formatLargeNumber(item.volume24h)}
                </div>
              </td>
              <td>
                <div className={styles.high}>
                  {formatCurrency(item.high24h)}
                </div>
              </td>
              <td>
                <div className={styles.low}>
                  {formatCurrency(item.low24h)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 加载中指示器 */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          color: '#6b7280',
          fontSize: '0.75rem',
          opacity: 0.7,
        }}>
          🔄 更新中...
        </div>
      )}
    </div>
  );
};

export default MarketOverview;