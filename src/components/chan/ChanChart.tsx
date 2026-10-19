import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  SeriesMarker,
  Time,
  Logical,
} from 'lightweight-charts';
import type { ChanAnalyzeResult, ChanBsp } from '../../services/chanAnalyzeAPI';
import { calcMACD } from '../replay/indicators';
import { ChanPrimitive, ChanLayers, toChartTime } from './ChanPrimitive';
import { bspLabel, formatPrice, formatTime } from './chanFormat';
import styles from './Chan.module.scss';

export interface BspLevels {
  bi: boolean;
  seg: boolean;
}

interface ChanChartProps {
  data: ChanAnalyzeResult | null;
  layers: ChanLayers;
  bspLevels: BspLevels;
  showMacd: boolean;
  isDark: boolean;
  /** 跳转到某根K线（klines 下标）；nonce 变化才触发，同一根可重复点 */
  focus: { index: number; nonce: number } | null;
  /** 视图标识（品种/周期/根数/历史时刻）：变化时回到最近 N 根，不变时刷新保留视野 */
  viewKey: string;
}

const UP = '#26a69a';
const DOWN = '#ef5350';
const BUY = '#16a34a';
const SELL = '#dc2626';
/** 首次加载 / 切换品种时默认显示最近多少根 */
const INITIAL_BARS = 300;

const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** 同一根K线同一方向的买卖点合并成一个标记 */
const buildMarkers = (bsp: ChanBsp[], levels: BspLevels): SeriesMarker<Time>[] => {
  const groups = new Map<string, ChanBsp[]>();
  for (const p of bsp) {
    if (!levels[p.level]) continue;
    const key = `${p.time}-${p.side}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  const markers: SeriesMarker<Time>[] = [];
  groups.forEach((list) => {
    const p0 = list[0];
    const isBuy = p0.side === 'buy';
    const hasSeg = list.some((p) => p.level === 'seg');
    const allConfirmed = list.every((p) => p.is_confirmed);
    const color = isBuy ? BUY : SELL;
    markers.push({
      time: toChartTime(p0.time),
      position: isBuy ? 'belowBar' : 'aboveBar',
      shape: isBuy ? 'arrowUp' : 'arrowDown',
      // 未确认：半透明 + 问号；线段级别：大号
      color: allConfirmed ? color : alpha(color, 0.45),
      size: hasSeg ? 2 : 1,
      text: list.map(bspLabel).join(' ') + (allConfirmed ? '' : '?'),
    });
  });
  return markers.sort((a, b) => (a.time as number) - (b.time as number));
};

const ChanChart: React.FC<ChanChartProps> = ({ data, layers, bspLevels, showMacd, isDark, focus, viewKey }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const macdRef = useRef<{ hist: ISeriesApi<'Histogram'>; dif: ISeriesApi<'Line'>; dea: ISeriesApi<'Line'> } | null>(null);
  const primitiveRef = useRef<ChanPrimitive | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const viewKeyRef = useRef<string>('');
  /** 图表重建（切主题 / MACD）前的视野，重建后恢复 */
  const savedRangeRef = useRef<{ from: number; to: number } | null>(null);
  // 图表重建后让数据 effect 重新灌数据
  const [chartVersion, setChartVersion] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const klines = useMemo(() => data?.klines ?? [], [data]);

  // chart time（秒）→ klines 下标
  const indexByTime = useMemo(() => {
    const m = new Map<number, number>();
    klines.forEach((k, i) => m.set(toChartTime(k.open_time), i));
    return m;
  }, [klines]);
  const indexByTimeRef = useRef(indexByTime);
  indexByTimeRef.current = indexByTime;

  const bspByTime = useMemo(() => {
    const m = new Map<number, ChanBsp[]>();
    for (const p of data?.bsp ?? []) {
      const list = m.get(p.time);
      if (list) list.push(p);
      else m.set(p.time, [p]);
    }
    return m;
  }, [data]);

  // 创建图表：主题或 MACD 开关变化时重建
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#d1d5db' : '#374151';
    const gridColor = isDark ? '#2b3443' : '#eef0f4';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { color: bg }, textColor, panes: { separatorColor: gridColor } },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: gridColor, rightOffset: 8 },
      rightPriceScale: { borderColor: gridColor },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candleRef.current = candle;

    const primitive = new ChanPrimitive();
    candle.attachPrimitive(primitive);
    primitiveRef.current = primitive;
    markersRef.current = createSeriesMarkers(candle, []);

    if (showMacd) {
      const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1);
      const dif = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, 1);
      const dea = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, 1);
      macdRef.current = { hist, dif, dea };
      chart.panes()[1]?.setHeight(130);
    } else {
      macdRef.current = null;
    }

    chart.subscribeCrosshairMove((param) => {
      if (param.time === undefined) {
        setHoverIndex(null);
        return;
      }
      setHoverIndex(indexByTimeRef.current.get(param.time as number) ?? null);
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);

    setChartVersion((v) => v + 1);

    return () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      savedRangeRef.current = range ? { from: range.from, to: range.to } : null;
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      macdRef.current = null;
      primitiveRef.current = null;
      markersRef.current = null;
    };
  }, [isDark, showMacd]);

  // 灌数据
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    candle.setData(
      klines.map((k) => ({ time: toChartTime(k.open_time), open: k.open, high: k.high, low: k.low, close: k.close })),
    );

    const macd = macdRef.current;
    if (macd) {
      const { dif, dea, hist } = calcMACD(klines.map((k) => k.close));
      const histData: { time: UTCTime; value: number; color: string }[] = [];
      const difData: { time: UTCTime; value: number }[] = [];
      const deaData: { time: UTCTime; value: number }[] = [];
      klines.forEach((k, i) => {
        const t = toChartTime(k.open_time);
        const h = hist[i];
        if (h !== null) histData.push({ time: t, value: h, color: h >= 0 ? alpha(UP, 0.7) : alpha(DOWN, 0.7) });
        if (dif[i] !== null) difData.push({ time: t, value: dif[i]! });
        if (dea[i] !== null) deaData.push({ time: t, value: dea[i]! });
      });
      macd.hist.setData(histData);
      macd.dif.setData(difData);
      macd.dea.setData(deaData);
    }

    // 换视图回到最近 N 根；同一视图下刷新保留视野（新图表实例需手动恢复）
    const n = klines.length;
    const saved = savedRangeRef.current;
    savedRangeRef.current = null;
    if (n) {
      if (viewKeyRef.current !== viewKey) {
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - INITIAL_BARS), to: n + 8 });
      } else if (saved) {
        chart.timeScale().setVisibleLogicalRange(saved);
      }
      viewKeyRef.current = viewKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, chartVersion]);

  // 结构和标记：开关变化只重画，不动视野
  useEffect(() => {
    primitiveRef.current?.setState({
      bis: data?.bis ?? [],
      segments: data?.segments ?? [],
      biCenters: data?.bi_centers ?? [],
      segCenters: data?.seg_centers ?? [],
      lastTime: data?.last_time ?? 0,
      layers,
    });
    markersRef.current?.setMarkers(data ? buildMarkers(data.bsp, bspLevels) : []);
  }, [data, layers, bspLevels, chartVersion]);

  // 跳转到某根K线，居中显示
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !focus) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    const half = range ? Math.max(30, (range.to - range.from) / 2) : 100;
    chart.timeScale().setVisibleLogicalRange({ from: (focus.index - half) as Logical, to: (focus.index + half) as Logical });
  }, [focus]);

  // 图例：悬停K线，否则最后一根
  const legendIndex = hoverIndex ?? (klines.length ? klines.length - 1 : null);
  const bar = legendIndex !== null ? klines[legendIndex] : null;
  const prev = legendIndex !== null && legendIndex > 0 ? klines[legendIndex - 1] : null;
  const change = bar && prev ? ((bar.close - prev.close) / prev.close) * 100 : null;
  const barBsp = bar ? (bspByTime.get(bar.open_time) ?? []) : [];

  return (
    <div className={styles.chartBox}>
      <div ref={containerRef} className={styles.chart} />
      {bar && (
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.legendTime}>{formatTime(bar.open_time)}</span>
            <span>开 {formatPrice(bar.open)}</span>
            <span>高 {formatPrice(bar.high)}</span>
            <span>低 {formatPrice(bar.low)}</span>
            <span>收 {formatPrice(bar.close)}</span>
            {change !== null && (
              <span className={change >= 0 ? styles.up : styles.down}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
          {barBsp.map((p, i) => (
            <div key={i} className={styles.legendBsp}>
              <span className={p.side === 'buy' ? styles.up : styles.down}>
                {p.level === 'seg' ? '线段' : '笔'}级 {bspLabel(p)}
              </span>
              <span>@ {formatPrice(p.price)}</span>
              {!p.is_confirmed && <span className={styles.warn}>未确认，可能消失</span>}
              {p.divergence_type && <span>{p.divergence_type === 'trend' ? '趋势背驰' : '盘整背驰'}</span>}
              {p.area_ratio !== undefined && <span>MACD 面积比 {p.area_ratio.toFixed(2)}</span>}
            </div>
          ))}
        </div>
      )}
      {!klines.length && <div className={styles.chartEmpty}>暂无数据</div>}
    </div>
  );
};

type UTCTime = ReturnType<typeof toChartTime>;

export default ChanChart;
