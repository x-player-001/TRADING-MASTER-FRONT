import React from 'react';
import styles from './MarketOverview.module.scss';
import { mockMarketData, formatCurrency, formatPercent, formatLargeNumber } from '../../utils/mockData';

const MarketOverview: React.FC = () => {
  const getSymbolIcon = (symbol: string) => {
    const symbolMap: { [key: string]: string } = {
      'BTCUSDT': '₿',
      'ETHUSDT': 'Ξ',
      'BNBUSDT': 'BNB',
      'SOLUSDT': 'SOL',
      'ADAUSDT': 'ADA'
    };
    return symbolMap[symbol] || symbol.substring(0, 2);
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? '↗' : '↘';
  };

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>币种</th>
            <th>价格</th>
            <th>24h涨跌</th>
            <th>24h成交量</th>
            <th>市值</th>
            <th>走势图</th>
          </tr>
        </thead>
        <tbody>
          {mockMarketData.map((item, index) => (
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
                <div className={styles.marketCap}>
                  {item.marketCap ? `$${formatLargeNumber(item.marketCap)}` : '-'}
                </div>
              </td>
              <td>
                <div className={styles.sparkline}>
                  📈
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MarketOverview;