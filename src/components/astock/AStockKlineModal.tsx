import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { astockAPI, KlineMark } from '../../services/astockAPI';
import styles from './AStockKlineModal.module.scss';

interface AStockKlineModalProps {
  code: string;
  name?: string;
  onClose: () => void;
  isDark?: boolean;
  sidebarCollapsed?: boolean;
}

// "2026-06-10" -> BusinessDay（日线用日期对象，避免时区偏移）
const toBusinessDay = (d: string) => {
  const [year, month, day] = d.split('-').map(Number);
  return { year, month, day };
};

// 计算 EMA
const calcEMA = (closes: number[], period: number) => {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < closes.length; i++) {
    ema = i === 0 ? closes[i] : closes[i] * k + ema * (1 - k);
    out.push(i >= period - 1 ? ema : null);
  }
  return out;
};

const AStockKlineModal: React.FC<AStockKlineModalProps> = ({ code, name, onClose, isDark = false, sidebarCollapsed = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockName, setStockName] = useState(name ?? '');
  const [marks, setMarks] = useState<KlineMark[]>([]);
  const [activeMark, setActiveMark] = useState<KlineMark | null>(null);

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
      timeScale: { timeVisible: false, secondsVisible: false, borderColor: gridColor },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: gridColor },
    });

    // A股配色：红涨绿跌
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef5350',
      downColor: '#26a69a',
      borderUpColor: '#ef5350',
      borderDownColor: '#26a69a',
      wickUpColor: '#ef5350',
      wickDownColor: '#26a69a',
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });

    // 成交量（叠加在底部独立刻度）
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    astockAPI.getKline(code, { limit: 250, adjust: 'hfq' })
      .then(res => {
        setStockName(res.name || code);
        setMarks(res.marks);

        const candleData = res.bars.map(b => ({
          time: toBusinessDay(b.trade_date),
          open: b.open, high: b.high, low: b.low, close: b.close,
        }));
        candleSeries.setData(candleData as any);

        const volData = res.bars.map(b => ({
          time: toBusinessDay(b.trade_date),
          value: b.volume,
          color: b.close >= b.open ? 'rgba(239,83,80,0.5)' : 'rgba(38,166,154,0.5)',
        }));
        volumeSeries.setData(volData as any);

        const closes = res.bars.map(b => b.close);
        const dates = res.bars.map(b => toBusinessDay(b.trade_date));
        const ema20 = calcEMA(closes, 20);
        ema20Series.setData(ema20.map((v, i) => v === null ? null : { time: dates[i], value: v }).filter(Boolean) as any);

        // 默认展示最近100根 + 右侧30格留白
        const barCount = res.bars.length;
        const visibleBars = 100;
        const rightOffset = 10;
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, barCount - visibleBars),
          to: barCount - 1 + rightOffset,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || '加载K线失败');
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
  }, [code, isDark]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={styles.overlay}
      style={{ paddingLeft: sidebarCollapsed ? '4rem' : '15rem' }}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.symbol}>{stockName || code}</span>
            <span className={styles.code}>{code}</span>
            <span className={styles.subtitle}>日线 · 后复权 · 最近250根</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.chartWrap} ref={chartContainerRef}>
            {loading && <div className={styles.loading}>加载中...</div>}
            {error && <div className={styles.errorMsg}>{error}</div>}
          </div>

          {marks.length > 0 && (
            <div className={styles.marksPanel}>
              <div className={styles.marksTitle}>选中记录（{marks.length}）</div>
              <div className={styles.marksList}>
                {marks.map((m) => (
                  <div
                    key={m.trade_date}
                    className={`${styles.markItem} ${activeMark?.trade_date === m.trade_date ? styles.markActive : ''}`}
                    onClick={() => setActiveMark(activeMark?.trade_date === m.trade_date ? null : m)}
                  >
                    <div className={styles.markHead}>
                      <span className={styles.markDate}>{m.trade_date}</span>
                      <span className={styles.markRank}>#{m.rank}</span>
                      <span className={styles.markScore}>{(m.total_score * 100).toFixed(1)}分</span>
                    </div>
                    {activeMark?.trade_date === m.trade_date && m.reasons && (
                      <div className={styles.markReasons}>{m.reasons}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AStockKlineModal;
