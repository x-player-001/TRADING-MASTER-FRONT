import React, { useEffect, useRef, useState } from 'react';
import { createChart, createSeriesMarkers, CandlestickSeries, LineSeries, HistogramSeries, LineStyle } from 'lightweight-charts';
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import {
  dailyBreakoutAPI,
  DailyBreakoutDetail,
  DailyBreakoutSignal,
  DAILY_BREAKOUT_LINE_TYPE_LABELS,
  DAILY_BREAKOUT_STATUS_LABELS,
} from '../../services/dailyBreakoutAPI';
import styles from './KlineModal.module.scss';

interface BreakoutChartModalProps {
  /** 列表里的那一行，先用它显示标题，图表数据按 id 另取 */
  signal: DailyBreakoutSignal;
  onClose: () => void;
  isDark?: boolean;
  sidebarCollapsed?: boolean;
}

const C_LINE = '#8b5cf6';
const C_TOUCH = '#8b5cf6';
const C_BREAK = '#22c55e';
const C_RETEST = '#f59e0b';
const C_FAIL = '#ef4444';

// 毫秒 UTC → 图表秒（+8 小时显示北京时间，与项目其他图表一致）
const toChartTime = (ms: number) => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

const stripUsdt = (s: string) => (s.toUpperCase().endsWith('USDT') ? s.slice(0, -4) : s);

const BreakoutChartModal: React.FC<BreakoutChartModalProps> = ({ signal, onClose, isDark = false, sidebarCollapsed = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const bg = isDark ? '#1e1e1e' : '#ffffff';
    const textColor = isDark ? '#d1d4dc' : '#191919';
    const gridColor = isDark ? '#2b2b43' : '#e1e3eb';

    const chart = createChart(container, {
      width: container.clientWidth || 900,
      height: 500,
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      // 突破/回踩多在最近几天，右侧留白免得标记挤在边上
      timeScale: { timeVisible: false, secondsVisible: false, borderColor: gridColor, rightOffset: 12 },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: gridColor },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const lineSeries = chart.addSeries(LineSeries, {
      color: C_LINE,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    let disposed = false;
    dailyBreakoutAPI.getSignal(signal.id)
      .then((d: DailyBreakoutDetail) => {
        if (disposed) return;
        const klines = (d.klines ?? []).slice().sort((a, b) => a.open_time - b.open_time);
        if (!klines.length) {
          setError('无K线数据');
          setLoading(false);
          return;
        }

        candleSeries.setData(klines.map(k => ({
          time: toChartTime(k.open_time),
          open: k.open, high: k.high, low: k.low, close: k.close,
        })));
        volumeSeries.setData(klines.map(k => ({
          time: toChartTime(k.open_time),
          value: k.volume,
          color: k.close >= k.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
        })));

        // 压力线：点按时间排好直接连
        lineSeries.setData(
          (d.line ?? [])
            .slice()
            .sort((a, b) => a.time - b.time)
            .map(p => ({ time: toChartTime(p.time), value: p.value }))
        );

        // 标记只打在有K线的日期上
        const barTimes = new Set(klines.map(k => k.open_time));
        const markers: SeriesMarker<Time>[] = [];
        (d.touches ?? []).forEach((t, i) => {
          if (barTimes.has(t.time)) {
            markers.push({ time: toChartTime(t.time), position: 'aboveBar', shape: 'circle', color: C_TOUCH, text: `触${i + 1}` });
          }
        });
        if (d.breakout_time && barTimes.has(d.breakout_time)) {
          markers.push({ time: toChartTime(d.breakout_time), position: 'belowBar', shape: 'arrowUp', color: C_BREAK, text: '突破' });
        }
        if (d.retest_time && barTimes.has(d.retest_time)) {
          markers.push({ time: toChartTime(d.retest_time), position: 'belowBar', shape: 'arrowUp', color: C_RETEST, text: '回踩' });
        }
        if (d.fail_time && barTimes.has(d.fail_time)) {
          markers.push({ time: toChartTime(d.fail_time), position: 'aboveBar', shape: 'arrowDown', color: C_FAIL, text: '失败' });
        }
        markers.sort((a, b) => (a.time as number) - (b.time as number));
        if (markers.length) createSeriesMarkers(candleSeries, markers);

        chart.timeScale().fitContent();
        setLoading(false);
      })
      .catch((err) => {
        if (disposed) return;
        setError(err instanceof Error ? err.message : '加载K线失败');
        setLoading(false);
      });

    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (w > 0) chart.applyOptions({ width: w });
    });
    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      chart.remove();
    };
  }, [signal.id, isDark]);

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
            <span className={styles.symbol}>{stripUsdt(signal.symbol)}</span>
            <span className={styles.timeframe}>1d</span>
            <span className={styles.subtitle}>
              {DAILY_BREAKOUT_LINE_TYPE_LABELS[signal.line_type] ?? signal.line_type}
              {' · '}{DAILY_BREAKOUT_STATUS_LABELS[signal.status] ?? signal.status}
              {' · '}{signal.touch_count} 触点 · 跨度 {signal.span_days} 天
              {' · '}<span style={{ color: C_LINE }}>━ 压力线</span>
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.chartWrap} ref={chartContainerRef}>
          {loading && <div className={styles.loading}>加载中...</div>}
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default BreakoutChartModal;
