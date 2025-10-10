import React from 'react';
import styles from './TradingSignals.module.scss';
import { mockTradingSignals, formatCurrency, formatTime } from '../../utils/mockData';

const TradingSignals: React.FC = () => {
  const getSignalIcon = (type: string) => {
    return type === 'BUY' ? '📈' : '📉';
  };

  const getTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;

    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  if (mockTradingSignals.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📡</div>
          <div className={styles.emptyText}>暂无交易信号</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.signalsList}>
        {mockTradingSignals.map((signal) => (
          <div
            key={signal.id}
            className={styles.signalItem}
            onClick={() => console.log('点击信号:', signal)}
          >
            <div className={styles.signalMain}>
              <div className={`${styles.signalIcon} ${styles[signal.type.toLowerCase()]}`}>
                {getSignalIcon(signal.type)}
              </div>

              <div className={styles.signalContent}>
                <div className={styles.signalHeader}>
                  <span className={styles.signalSymbol}>
                    {signal.symbol.replace('USDT', '')}/USDT
                  </span>
                  <span className={`${styles.signalType} ${styles[signal.type.toLowerCase()]}`}>
                    {signal.type}
                  </span>
                  <span className={styles.signalPrice}>
                    {formatCurrency(signal.price)}
                  </span>
                </div>

                <div className={styles.signalDescription}>
                  {signal.description}
                </div>
              </div>
            </div>

            <div className={styles.signalMeta}>
              <div className={styles.signalTime}>
                {getTimeAgo(signal.timestamp)}
              </div>

              <div className={styles.signalConfidence}>
                <span className={styles.confidenceLabel}>
                  {Math.round(signal.confidence * 100)}%
                </span>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${signal.confidence * 100}%` }}
                  />
                </div>
              </div>

              <span className={`${styles.signalStatus} ${styles[signal.status.toLowerCase()]}`}>
                {signal.status === 'ACTIVE' ? '活跃' :
                 signal.status === 'EXECUTED' ? '已执行' : '已过期'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TradingSignals;