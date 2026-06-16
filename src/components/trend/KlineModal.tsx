import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { trendFollowAPI, WatchContext } from '../../services/trendFollowAPI';
import styles from './KlineModal.module.scss';

interface KlineModalProps {
  ctx: WatchContext;
  onClose: () => void;
  onDelete: (id: number) => void;
  isDark?: boolean;
  sidebarCollapsed?: boolean;
}

const KlineModal: React.FC<KlineModalProps> = ({ ctx, onClose, onDelete, isDark = false, sidebarCollapsed = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const bg = isDark ? '#1e1e1e' : '#ffffff';
    const textColor = isDark ? '#d1d4dc' : '#191919';
    const gridColor = isDark ? '#2b2b43' : '#e1e3eb';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 500,
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      timeScale: { timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: gridColor },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const emaSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    trendFollowAPI.getLatestKlines(ctx.symbol, ctx.timeframe, 150)
      .then(klines => {
        const data = klines.map(k => ({
          time: Math.floor(k.open_time / 1000) + 8 * 3600,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        candleSeries.setData(data);

        // 计算 EMA20
        const emaData: { time: number; value: number }[] = [];
        const k = 2 / (20 + 1);
        let ema = 0;
        klines.forEach((bar, i) => {
          if (i === 0) {
            ema = bar.close;
          } else {
            ema = bar.close * k + ema * (1 - k);
          }
          if (i >= 19) {
            emaData.push({ time: Math.floor(bar.open_time / 1000) + 8 * 3600, value: ema });
          }
        });
        emaSeries.setData(emaData);

        chart.timeScale().fitContent();
        setLoading(false);
      })
      .catch(() => {
        setError('加载K线失败');
        setLoading(false);
      });

    const observer = new ResizeObserver(() => {
      if (container) chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [ctx.symbol, ctx.timeframe, isDark]);

  // 点击遮罩关闭
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const stripUsdt = (s: string) =>
    s.toUpperCase().endsWith('USDT') ? s.slice(0, -4) : s;

  return (
    <div
      className={styles.overlay}
      style={{ paddingLeft: sidebarCollapsed ? '4rem' : '15rem' }}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.symbol}>{stripUsdt(ctx.symbol)}</span>
            <span className={styles.timeframe}>{ctx.timeframe}</span>
            <span className={styles.subtitle}>最近150根K线</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.chartWrap} ref={chartContainerRef}>
          {loading && <div className={styles.loading}>加载中...</div>}
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.deleteBtn}
            onClick={() => { onDelete(ctx.id); onClose(); }}
          >
            删除该观察区
          </button>
        </div>
      </div>
    </div>
  );
};

export default KlineModal;
