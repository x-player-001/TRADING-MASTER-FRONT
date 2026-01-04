import React, { useMemo } from 'react';
import styles from './OIRecentAlerts.module.scss';
import { VolumeAlert } from '../../services/volumeMonitorAPI';

interface VolumeImportantAlertsProps {
  alerts: VolumeAlert[];
}

interface ImportantAlertItem {
  symbol: string;
  direction: 'UP' | 'DOWN';
  minutesAgo: number;
  timeInterval: number;
  timestamp: number;
}

const VolumeImportantAlerts: React.FC<VolumeImportantAlertsProps> = ({ alerts }) => {
  // 筛选最近30分钟内的重要报警
  const importantAlerts = useMemo((): ImportantAlertItem[] => {
    if (!alerts || alerts.length === 0) {
      return [];
    }

    const now = Date.now();
    const halfHourAgo = now - 30 * 60 * 1000;

    // 筛选重要报警且在30分钟内
    const filteredAlerts = alerts
      .filter(alert => {
        if (!alert.is_important) return false;
        const ts = alert.created_at.endsWith('Z')
          ? alert.created_at.slice(0, -1)
          : alert.created_at;
        const alertTimestamp = new Date(ts).getTime();
        return alertTimestamp >= halfHourAgo;
      })
      .map(alert => {
        const ts = alert.created_at.endsWith('Z')
          ? alert.created_at.slice(0, -1)
          : alert.created_at;
        const alertTimestamp = new Date(ts).getTime();
        const minutesAgo = Math.floor((now - alertTimestamp) / 60000);

        return {
          symbol: alert.symbol,
          direction: alert.direction,
          minutesAgo,
          timeInterval: Math.floor(minutesAgo / 5) * 5,
          timestamp: alertTimestamp
        };
      });

    // 去重，每个代币只保留最近的一个
    const uniqueMap = new Map<string, ImportantAlertItem>();
    filteredAlerts.forEach(item => {
      const existing = uniqueMap.get(item.symbol);
      if (!existing || item.timestamp > existing.timestamp) {
        uniqueMap.set(item.symbol, item);
      }
    });

    // 按时间排序（最近的在前）
    return Array.from(uniqueMap.values())
      .sort((a, b) => a.minutesAgo - b.minutesAgo);
  }, [alerts]);

  // 根据时间区间分配颜色
  const getColorClass = (interval: number) => {
    if (interval >= 0 && interval < 5) return styles.interval0;
    if (interval >= 5 && interval < 10) return styles.interval10;
    if (interval >= 10 && interval < 15) return styles.interval20;
    if (interval >= 15 && interval < 20) return styles.interval30;
    if (interval >= 20 && interval < 25) return styles.interval40;
    return styles.interval50;
  };

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timelineLabel}>
        <span className={styles.timelineLabelIcon}>🔥</span>
        <span className={styles.timelineLabelText}>重要放量</span>
        {importantAlerts.length > 0 && (
          <span className={styles.timelineCount}>{importantAlerts.length} 个</span>
        )}
      </div>
      {importantAlerts.length > 0 && (
        <div className={styles.timelineScroll}>
          <div className={styles.timelineTrack}>
            {importantAlerts.map((item, index) => {
              const tradingViewUrl = `https://cn.tradingview.com/chart/j4BQzamt/?symbol=BINANCE%3A${item.symbol}USDT.P&interval=5`;

              return (
                <a
                  key={`${item.symbol}-${index}`}
                  href={tradingViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.timelineItem} ${getColorClass(item.timeInterval)}`}
                  title={`${item.symbol} - ${item.direction === 'UP' ? '放量上涨' : '放量下跌'} (${item.minutesAgo}分钟前) - 点击打开TradingView`}
                >
                  <span className={styles.timelineSymbol}>{item.symbol}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumeImportantAlerts;
