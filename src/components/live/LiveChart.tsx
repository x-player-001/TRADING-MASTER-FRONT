import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';
import {
  fetchRelayKlines,
  marketRelaySocket,
  INTERVAL_MS,
  RelayInterval,
  RelayKline,
} from '../../services/marketRelayAPI';
import { cacheGet, cacheKeyOf, cacheSet, PAGE_SIZE } from './klineCache';
import { calcMACD, calcSMA, MacdResult } from '../replay/indicators';
import { CountdownPrimitive } from '../replay/CountdownPrimitive';
import { MeasurePoint, MeasurePrimitive } from './MeasurePrimitive';
import styles from './LiveChart.module.scss';

interface LiveChartProps {
  symbol: string;
  interval: RelayInterval;
  isDark: boolean;
  /** 最新价变化（用于页面标题等） */
  onLastBar?: (k: RelayKline | null) => void;
  /** 主图叠加均线 MA20/60 */
  showMa?: boolean;
  /** 副图 MACD(12,26,9) */
  showMacd?: boolean;
  /** 主图价格轴用对数坐标 */
  logScale?: boolean;
}

const UP = '#26a69a';
const DOWN = '#ef5350';
/** 可见范围左端离第一根不足多少根时加载更早数据 */
const LOAD_MORE_THRESHOLD = 30;
/** 首次加载默认显示最近多少根 */
const INITIAL_BARS = 150;

const MA_LINES = [
  { n: 20, color: '#f59e0b' },
  { n: 60, color: '#8b5cf6' },
] as const;
const DIF_COLOR = '#3b82f6';
const DEA_COLOR = '#f59e0b';
const MACD_PANE = 1;

/** MACD 柱：零轴上绿下红，比前一根缩短时颜色变淡 */
const histColor = (v: number, prev: number | null) => {
  const weakening = prev !== null && Math.abs(v) < Math.abs(prev);
  if (v >= 0) return weakening ? 'rgba(38,166,154,0.45)' : UP;
  return weakening ? 'rgba(239,83,80,0.45)' : DOWN;
};

/** 按 open_time 二分查找下标，找不到返回 -1 */
const indexOfTime = (bars: RelayKline[], openTime: number) => {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = bars[mid].open_time;
    if (t === openTime) return mid;
    if (t < openTime) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
};

/** lightweight-charts 不支持时区，统一 +8 小时显示北京时间 */
const toChartTime = (ms: number) => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

const toCandle = (k: RelayKline) => ({ time: toChartTime(k.open_time), open: k.open, high: k.high, low: k.low, close: k.close });
const toVolume = (k: RelayKline) => ({
  time: toChartTime(k.open_time),
  value: k.volume,
  color: k.close >= k.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
});

/** 从价格推断显示精度（最多 8 位） */
const inferPrecision = (bars: RelayKline[]) => {
  let p = 0;
  for (const k of bars.slice(-200)) {
    for (const v of [k.open, k.high, k.low, k.close]) {
      const s = String(v);
      const i = s.indexOf('.');
      if (i >= 0) p = Math.max(p, s.length - i - 1);
    }
  }
  return Math.min(Math.max(p, 2), 8);
};

const formatVolume = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(2);
};

const formatCountdown = (ms: number) => {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}天 ${pad(h)}:${pad(m)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
  return `${pad(m)}:${pad(s % 60)}`;
};

/** 测量框的时长：「45分钟」「3小时20分」「2天5小时」 */
const formatSpan = (ms: number) => {
  const m = Math.round(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return h ? `${d}天${h}小时` : `${d}天`;
  if (h > 0) return min ? `${h}小时${min}分` : `${h}小时`;
  return `${min}分钟`;
};

const formatBarTime = (ms: number, interval: RelayInterval) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return INTERVAL_MS[interval] >= 86_400_000 ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const LiveChart: React.FC<LiveChartProps> = ({ symbol, interval, isDark, onLastBar, showMa = true, showMacd = true, logScale = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const countdownRef = useRef<CountdownPrimitive | null>(null);
  const measureRef = useRef<MeasurePrimitive | null>(null);
  /** Shift 拖动测量的起止点，null 表示没有测量 */
  const measurePtsRef = useRef<{ from: MeasurePoint; to: MeasurePoint } | null>(null);
  const maRef = useRef<ISeriesApi<'Line'>[]>([]);
  const macdRef = useRef<{ hist: ISeriesApi<'Histogram'>; dif: ISeriesApi<'Line'>; dea: ISeriesApi<'Line'> } | null>(null);
  /** 指标值，下标与 barsRef 对齐 */
  const indRef = useRef<{ ma: (number | null)[][]; macd: MacdResult | null }>({ ma: [], macd: null });
  const showRef = useRef({ ma: showMa, macd: showMacd });
  showRef.current = { ma: showMa, macd: showMacd };
  const precisionRef = useRef(2);

  /** 当前图上的全部 K 线（升序），实时推送高频更新，不放进 React state */
  const barsRef = useRef<RelayKline[]>([]);
  const onLastBarRef = useRef(onLastBar);
  onLastBarRef.current = onLastBar;
  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  /** 按起止点算标签（涨跌、根数、时长、区间成交量）并重画测量框 */
  const drawMeasure = useCallback(() => {
    const pts = measurePtsRef.current;
    if (!pts) {
      measureRef.current?.setState(null);
      return;
    }
    const { from, to } = pts;
    const diff = to.price - from.price;
    const pct = from.price ? (diff / from.price) * 100 : 0;
    const sign = diff >= 0 ? '+' : '';
    const n = Math.abs(to.logical - from.logical);
    const bars = barsRef.current;
    const lo = Math.max(0, Math.min(from.logical, to.logical));
    const hi = Math.min(bars.length - 1, Math.max(from.logical, to.logical));
    let vol = 0;
    for (let i = lo; i <= hi; i++) vol += bars[i].volume;
    measureRef.current?.setState({
      from,
      to,
      lines: [
        `${sign}${diff.toFixed(precisionRef.current)} (${sign}${pct.toFixed(2)}%)`,
        `${n} 根 · ${formatSpan(n * INTERVAL_MS[intervalRef.current])}`,
        `量 ${formatVolume(vol)}`,
      ],
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverBar, setHoverBar] = useState<RelayKline | null>(null);
  const [lastBar, setLastBar] = useState<RelayKline | null>(null);
  const [precision, setPrecision] = useState(2);
  const [now, setNow] = useState(() => Date.now());

  // 创建图表（只建一次，主题变化用 applyOptions）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 8 },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candleRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
    countdownRef.current = new CountdownPrimitive();
    candleRef.current.attachPrimitive(countdownRef.current);
    measureRef.current = new MeasurePrimitive();
    candleRef.current.attachPrimitive(measureRef.current);

    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    maRef.current = MA_LINES.map(({ color }) =>
      chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
    );

    chart.subscribeCrosshairMove((param) => {
      if (param.time === undefined) {
        setHoverBar(null);
        return;
      }
      // 图表时间 = UTC 秒 + 8 小时，换回 open_time 毫秒
      const i = indexOfTime(barsRef.current, ((param.time as number) - 8 * 3600) * 1000);
      setHoverBar(i >= 0 ? barsRef.current[i] : null);
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);

    // 测量（同 TradingView）：Shift + 点一下开始，终点跟着鼠标走，再点一下固定；也可以 Shift + 按住拖动、松开固定。
    // 不按 Shift 点一下或 Esc 清除。拦截在捕获阶段做，图表就不会跟着平移
    /** 终点正在跟随鼠标 */
    let following = false;
    /** 开始那一下的按下位置：松开时挪动过就算拖动测量，直接固定 */
    let downAt: { x: number; y: number } | null = null;
    /** pointerdown 已处理，紧跟着的 mousedown 也要拦下 */
    let swallowMouseDown = false;
    const pointAt = (e: MouseEvent): MeasurePoint | null => {
      const rect = container.getBoundingClientRect();
      const logical = chart.timeScale().coordinateToLogical(e.clientX - rect.left);
      const price = candleRef.current?.coordinateToPrice(e.clientY - rect.top) ?? null;
      return logical === null || price === null ? null : { logical: Math.round(logical), price };
    };
    const clearMeasure = () => {
      following = false;
      downAt = null;
      if (!measurePtsRef.current) return;
      measurePtsRef.current = null;
      drawMeasure();
    };
    // 只在主图里测量（不含价格轴、时间轴、MACD 副图）
    const inMainPane = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pane = chart.paneSize(0);
      return e.clientX - rect.left <= pane.width && e.clientY - rect.top <= pane.height;
    };
    const swallow = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!swallowMouseDown) return;
      swallowMouseDown = false;
      swallow(e);
    };
    const onPointerDown = (e: PointerEvent) => {
      swallowMouseDown = false;
      if (e.button !== 0) return;
      // 切换币种 / 周期时测量被清掉了
      if (!measurePtsRef.current) following = false;
      if (following) {
        if (!inMainPane(e)) return;
        swallow(e);
        swallowMouseDown = true;
        const pt = pointAt(e);
        if (pt) measurePtsRef.current = { ...measurePtsRef.current!, to: pt };
        following = false;
        drawMeasure();
        return;
      }
      if (!e.shiftKey) {
        clearMeasure();
        return;
      }
      if (!inMainPane(e)) return;
      swallow(e);
      swallowMouseDown = true;
      const pt = pointAt(e);
      if (!pt) return;
      following = true;
      downAt = { x: e.clientX, y: e.clientY };
      measurePtsRef.current = { from: pt, to: pt };
      drawMeasure();
    };
    const onMove = (e: MouseEvent) => {
      if (!following || !measurePtsRef.current) return;
      const pt = pointAt(e);
      if (!pt) return;
      measurePtsRef.current = { ...measurePtsRef.current, to: pt };
      drawMeasure();
    };
    const onUp = (e: PointerEvent) => {
      if (!downAt) return;
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) following = false;
      downAt = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearMeasure();
    };
    container.addEventListener('pointerdown', onPointerDown, true);
    container.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true);
      container.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      countdownRef.current = null;
      measureRef.current = null;
      volumeRef.current = null;
      maRef.current = [];
      macdRef.current = null;
    };
  }, [drawMeasure]);

  /**
   * 重算指标。full=true 时整段 setData（加载、补拉、翻页、开关指标）；
   * 否则只更新最后一根（实时推送，约 250ms 一次）。整段重算是 O(n)，几千根开销很小
   */
  const renderIndicators = useCallback((full: boolean) => {
    const chart = chartRef.current;
    if (!chart) return;
    const bars = barsRef.current;
    const closes = bars.map((k) => k.close);
    const times = bars.map((k) => toChartTime(k.open_time));
    const last = bars.length - 1;
    const { ma: wantMa, macd: wantMacd } = showRef.current;
    const p = precisionRef.current;
    const priceFormat = { type: 'price' as const, precision: p, minMove: 1 / 10 ** p };
    const toLine = (vals: (number | null)[]) => vals.flatMap((v, i) => (v === null ? [] : [{ time: times[i], value: v }]));

    indRef.current = {
      ma: wantMa ? MA_LINES.map(({ n }) => calcSMA(closes, n)) : [],
      macd: wantMacd ? calcMACD(closes) : null,
    };
    const { ma, macd } = indRef.current;

    maRef.current.forEach((series, j) => {
      if (full) {
        series.applyOptions({ visible: wantMa, priceFormat });
        series.setData(wantMa ? toLine(ma[j]) : []);
      } else if (wantMa && last >= 0 && ma[j][last] !== null) {
        series.update({ time: times[last], value: ma[j][last]! });
      }
    });

    if (!macd) {
      if (macdRef.current) {
        chart.removeSeries(macdRef.current.hist);
        chart.removeSeries(macdRef.current.dif);
        chart.removeSeries(macdRef.current.dea);
        macdRef.current = null;
        if (chart.panes().length > MACD_PANE) chart.removePane(MACD_PANE);
      }
      return;
    }
    if (!macdRef.current) {
      const common = { priceLineVisible: false, crosshairMarkerVisible: false };
      macdRef.current = {
        hist: chart.addSeries(HistogramSeries, { ...common, lastValueVisible: false }, MACD_PANE),
        dif: chart.addSeries(LineSeries, { ...common, color: DIF_COLOR, lineWidth: 1 }, MACD_PANE),
        dea: chart.addSeries(LineSeries, { ...common, color: DEA_COLOR, lineWidth: 1 }, MACD_PANE),
      };
      // 主图 : 副图 ≈ 3 : 1
      chart.panes()[0]?.setStretchFactor(3);
      chart.panes()[MACD_PANE]?.setStretchFactor(1);
      full = true;
    }
    const { hist, dif, dea } = macdRef.current;
    if (full) {
      [hist, dif, dea].forEach((s) => s.applyOptions({ priceFormat }));
      hist.setData(macd.hist.flatMap((v, i) => (v === null ? [] : [{ time: times[i], value: v, color: histColor(v, macd.hist[i - 1] ?? null) }])));
      dif.setData(toLine(macd.dif));
      dea.setData(toLine(macd.dea));
      return;
    }
    const h = macd.hist[last];
    if (h !== null && h !== undefined) hist.update({ time: times[last], value: h, color: histColor(h, macd.hist[last - 1] ?? null) });
    if (macd.dif[last] !== null) dif.update({ time: times[last], value: macd.dif[last]! });
    if (macd.dea[last] !== null) dea.update({ time: times[last], value: macd.dea[last]! });
  }, []);

  // 开关指标
  useEffect(() => {
    renderIndicators(true);
  }, [showMa, showMacd, renderIndicators]);

  // 主题
  useEffect(() => {
    const bg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#d1d5db' : '#374151';
    const gridColor = isDark ? '#2b3443' : '#eef0f4';
    chartRef.current?.applyOptions({
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      timeScale: { borderColor: gridColor },
      rightPriceScale: { borderColor: gridColor },
    });
  }, [isDark]);

  // 对数坐标：只作用于主图价格轴（K 线、均线），成交量和 MACD 各有自己的轴
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [logScale]);

  // 倒计时
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // 价格轴：最新价标签下方显示本根K线剩余时间
  useEffect(() => {
    countdownRef.current?.setState({
      price: lastBar ? lastBar.close : null,
      text: lastBar ? formatCountdown(lastBar.close_time + 1 - now) : '',
      color: lastBar && lastBar.close < lastBar.open ? DOWN : UP,
    });
  }, [lastBar, now]);

  // 数据：先订阅（推送先缓冲），再拉最新一页，然后回放缓冲区；之后推送直接 update
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    const volume = volumeRef.current;
    if (!chart || !candle || !volume) return;

    let disposed = false;
    /** 为 false 时推送进缓冲区（首次加载 / 补拉期间） */
    let ready = false;
    let buffer: RelayKline[] = [];
    let exhausted = false;
    let loadingOlder = false;
    let backfilling = false;

    barsRef.current = [];
    candle.setData([]);
    volume.setData([]);
    setLastBar(null);
    setHoverBar(null);
    setError(null);
    measurePtsRef.current = null;
    drawMeasure();
    // 上一个周期还在加载时切走，它的 finally 因 disposed 不会清 loading；命中缓存时这里不清会一直挂着
    setLoading(false);
    onLastBarRef.current?.(null);
    renderIndicators(true);

    const publishLast = () => {
      const last = barsRef.current[barsRef.current.length - 1] ?? null;
      setLastBar(last);
      onLastBarRef.current?.(last);
    };

    /** 应用一根 K 线：同一根就更新，更新的就追加，更早的忽略 */
    const applyBar = (k: RelayKline): boolean => {
      const bars = barsRef.current;
      const last = bars[bars.length - 1];
      if (last && k.open_time < last.open_time) return false;
      if (last && k.open_time === last.open_time) bars[bars.length - 1] = k;
      else bars.push(k);
      candle.update(toCandle(k));
      volume.update(toVolume(k));
      return true;
    };

    const flushBuffer = () => {
      const pending = buffer;
      buffer = [];
      pending.sort((a, b) => a.open_time - b.open_time).forEach(applyBar);
      ready = true;
      renderIndicators(true);
      publishLast();
    };

    /** 用 REST 从本地最后一根开始补拉（断线、上游重连、推送出现缺口） */
    const backfill = async () => {
      const last = barsRef.current[barsRef.current.length - 1];
      if (!last || backfilling) return;
      backfilling = true;
      ready = false;
      try {
        // limit 按缺口算：通常只缺几根，<100 根只算 1 权重
        const gap = Math.ceil((Date.now() - last.open_time) / INTERVAL_MS[interval]) + 2;
        const page = await fetchRelayKlines({ symbol, interval, start_time: last.open_time, limit: Math.min(1500, gap) });
        if (disposed) return;
        page.forEach(applyBar);
      } catch (err) {
        console.warn('[LiveChart] 补拉失败', err);
      } finally {
        backfilling = false;
        if (!disposed) flushBuffer();
      }
    };

    const removeListener = marketRelaySocket.addListener({
      onKline: (k) => {
        if (k.symbol !== symbol || k.interval !== interval) return;
        if (!ready) {
          buffer.push(k);
          return;
        }
        const last = barsRef.current[barsRef.current.length - 1];
        // 推送跳过了 K 线（比如后台标签页被节流）：先补拉
        if (last && k.open_time - last.open_time > INTERVAL_MS[interval] * 1.5 && interval !== '1M') {
          buffer.push(k);
          backfill();
          return;
        }
        if (applyBar(k)) {
          renderIndicators(false);
          publishLast();
        }
      },
      onResync: (streams) => {
        if (streams.some((s) => s.symbol === symbol && s.interval === interval)) backfill();
      },
      onError: (message) => console.warn('[MarketRelay]', message),
    });
    const unsubscribe = marketRelaySocket.subscribe(symbol, interval);

    const cacheKey = cacheKeyOf(symbol, interval);
    const showInitial = (bars: RelayKline[]) => {
      barsRef.current = bars;
      const p = inferPrecision(bars);
      setPrecision(p);
      precisionRef.current = p;
      candle.applyOptions({ priceFormat: { type: 'price', precision: p, minMove: 1 / 10 ** p } });
      candle.setData(bars.map(toCandle));
      volume.setData(bars.map(toVolume));
    };
    const showLatest = () => {
      const n = barsRef.current.length;
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - INITIAL_BARS), to: n + 8 });
    };

    const cached = cacheGet(cacheKey, interval);
    if (cached) {
      // 命中缓存：立即显示，再补拉切走期间的 K 线（补拉结束会回放推送缓冲区）
      showInitial(cached.bars);
      exhausted = cached.exhausted;
      renderIndicators(true);
      publishLast();
      showLatest();
      backfill();
    } else {
      setLoading(true);
      fetchRelayKlines({ symbol, interval, limit: PAGE_SIZE })
        .then((page) => {
          if (disposed) return;
          showInitial(page);
          exhausted = page.length < PAGE_SIZE;
          flushBuffer();
          showLatest();
        })
        .catch((err: Error) => {
          if (!disposed) setError(err.message);
        })
        .finally(() => {
          if (!disposed) setLoading(false);
        });
    }

    // 往左拖到头：加载更早一页
    const onRangeChange = (range: { from: number; to: number } | null) => {
      if (!range || !ready || exhausted || loadingOlder || range.from > LOAD_MORE_THRESHOLD) return;
      const first = barsRef.current[0];
      if (!first) return;
      loadingOlder = true;
      setLoadingMore(true);
      fetchRelayKlines({ symbol, interval, limit: PAGE_SIZE, end_time: first.open_time - 1 })
        .then((page) => {
          if (disposed) return;
          const older = page.filter((k) => k.open_time < barsRef.current[0].open_time);
          if (page.length < PAGE_SIZE) exhausted = true;
          if (older.length === 0) return;
          const visible = chart.timeScale().getVisibleLogicalRange();
          barsRef.current = [...older, ...barsRef.current];
          // 前面插了 older.length 根，测量框的逻辑序号一起右移
          const pts = measurePtsRef.current;
          if (pts) {
            measurePtsRef.current = {
              from: { ...pts.from, logical: pts.from.logical + older.length },
              to: { ...pts.to, logical: pts.to.logical + older.length },
            };
            drawMeasure();
          }
          candle.setData(barsRef.current.map(toCandle));
          volume.setData(barsRef.current.map(toVolume));
          renderIndicators(true);
          // 保持视野不跳：逻辑序号整体右移 older.length
          if (visible) {
            chart.timeScale().setVisibleLogicalRange({ from: visible.from + older.length, to: visible.to + older.length });
          }
        })
        .catch((err) => console.warn('[LiveChart] 加载更早数据失败', err))
        .finally(() => {
          loadingOlder = false;
          if (!disposed) setLoadingMore(false);
        });
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    return () => {
      disposed = true;
      cacheSet(cacheKey, barsRef.current, exhausted);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      removeListener();
      unsubscribe();
    };
  }, [symbol, interval, renderIndicators, drawMeasure]);

  const shown = hoverBar ?? lastBar;
  const change = shown ? shown.close - shown.open : 0;
  const changePct = shown && shown.open ? (change / shown.open) * 100 : 0;
  const tone = change >= 0 ? styles.up : styles.down;
  // 指标数值跟随十字光标（没有悬停时取最新一根）
  const shownIdx = shown ? indexOfTime(barsRef.current, shown.open_time) : -1;
  const { ma: maVals, macd: macdVals } = indRef.current;
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toFixed(precision));

  return (
    <div className={styles.wrap}>
      <div ref={containerRef} className={styles.chart} />

      <div className={styles.legend}>
        <div className={styles.legendTitle}>
          <span className={styles.symbol}>{symbol}</span>
          <span className={styles.dim}>{interval} · 币安永续</span>
        </div>
        {shown && (
          <div className={`${styles.ohlc} ${styles.mono}`}>
            <span className={styles.dim}>{formatBarTime(shown.open_time, interval)}</span>
            <span>开 <b className={tone}>{shown.open.toFixed(precision)}</b></span>
            <span>高 <b className={tone}>{shown.high.toFixed(precision)}</b></span>
            <span>低 <b className={tone}>{shown.low.toFixed(precision)}</b></span>
            <span>收 <b className={tone}>{shown.close.toFixed(precision)}</b></span>
            <span className={tone}>
              {change >= 0 ? '+' : ''}{change.toFixed(precision)} ({change >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
            <span>量 <b>{formatVolume(shown.volume)}</b></span>
          </div>
        )}
        {shown && showMa && maVals.length > 0 && (
          <div className={`${styles.ohlc} ${styles.mono}`}>
            {MA_LINES.map(({ n, color }, j) => (
              <span key={n} style={{ color }}>MA{n} {fmt(maVals[j]?.[shownIdx])}</span>
            ))}
          </div>
        )}
        {shown && showMacd && macdVals && (
          <div className={`${styles.ohlc} ${styles.mono}`}>
            <span className={styles.dim}>MACD(12,26,9)</span>
            <span style={{ color: DIF_COLOR }}>DIF {fmt(macdVals.dif[shownIdx])}</span>
            <span style={{ color: DEA_COLOR }}>DEA {fmt(macdVals.dea[shownIdx])}</span>
            <span className={(macdVals.hist[shownIdx] ?? 0) >= 0 ? styles.up : styles.down}>柱 {fmt(macdVals.hist[shownIdx])}</span>
          </div>
        )}
      </div>

      {loadingMore && <div className={styles.loadingMore}>加载更早数据…</div>}
      {loading && <div className={styles.overlay}>加载中…</div>}
      {error && !loading && <div className={`${styles.overlay} ${styles.error}`}>{error}</div>}
    </div>
  );
};

export default LiveChart;
