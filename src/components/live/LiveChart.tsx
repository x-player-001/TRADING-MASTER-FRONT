import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
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
import styles from './LiveChart.module.scss';

interface LiveChartProps {
  symbol: string;
  interval: RelayInterval;
  isDark: boolean;
  /** 最新价变化（用于页面标题等） */
  onLastBar?: (k: RelayKline | null) => void;
}

const UP = '#26a69a';
const DOWN = '#ef5350';
const PAGE_SIZE = 500;
/** 可见范围左端离第一根不足多少根时加载更早数据 */
const LOAD_MORE_THRESHOLD = 30;
/** 首次加载默认显示最近多少根 */
const INITIAL_BARS = 150;

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

const formatBarTime = (ms: number, interval: RelayInterval) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return INTERVAL_MS[interval] >= 86_400_000 ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const LiveChart: React.FC<LiveChartProps> = ({ symbol, interval, isDark, onLastBar }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  /** 当前图上的全部 K 线（升序），实时推送高频更新，不放进 React state */
  const barsRef = useRef<RelayKline[]>([]);
  const onLastBarRef = useRef(onLastBar);
  onLastBarRef.current = onLastBar;

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

    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const timeToBar = (t: number) => {
      const bars = barsRef.current;
      // 二分查找
      let lo = 0;
      let hi = bars.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const mt = toChartTime(bars[mid].open_time);
        if (mt === t) return bars[mid];
        if (mt < t) lo = mid + 1;
        else hi = mid - 1;
      }
      return null;
    };
    chart.subscribeCrosshairMove((param) => {
      setHoverBar(param.time === undefined ? null : timeToBar(param.time as number));
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

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

  // 倒计时
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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
    onLastBarRef.current?.(null);

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
      publishLast();
    };

    /** 用 REST 从本地最后一根开始补拉（断线、上游重连、推送出现缺口） */
    const backfill = async () => {
      const last = barsRef.current[barsRef.current.length - 1];
      if (!last || backfilling) return;
      backfilling = true;
      ready = false;
      try {
        const page = await fetchRelayKlines({ symbol, interval, start_time: last.open_time, limit: 1500 });
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
        if (applyBar(k)) publishLast();
      },
      onResync: (streams) => {
        if (streams.some((s) => s.symbol === symbol && s.interval === interval)) backfill();
      },
      onError: (message) => console.warn('[MarketRelay]', message),
    });
    const unsubscribe = marketRelaySocket.subscribe(symbol, interval);

    setLoading(true);
    fetchRelayKlines({ symbol, interval, limit: PAGE_SIZE })
      .then((page) => {
        if (disposed) return;
        barsRef.current = page;
        const p = inferPrecision(page);
        setPrecision(p);
        candle.applyOptions({ priceFormat: { type: 'price', precision: p, minMove: 1 / 10 ** p } });
        candle.setData(page.map(toCandle));
        volume.setData(page.map(toVolume));
        exhausted = page.length < PAGE_SIZE;
        flushBuffer();
        const n = barsRef.current.length;
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - INITIAL_BARS), to: n + 8 });
      })
      .catch((err: Error) => {
        if (!disposed) setError(err.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

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
          candle.setData(barsRef.current.map(toCandle));
          volume.setData(barsRef.current.map(toVolume));
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
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      removeListener();
      unsubscribe();
    };
  }, [symbol, interval]);

  const shown = hoverBar ?? lastBar;
  const change = shown ? shown.close - shown.open : 0;
  const changePct = shown && shown.open ? (change / shown.open) * 100 : 0;
  const tone = change >= 0 ? styles.up : styles.down;
  const remain = lastBar ? lastBar.close_time + 1 - now : 0;

  return (
    <div className={styles.wrap}>
      <div ref={containerRef} className={styles.chart} />

      <div className={styles.legend}>
        <div className={styles.legendTitle}>
          <span className={styles.symbol}>{symbol}</span>
          <span className={styles.dim}>{interval} · 币安永续</span>
          {lastBar && !hoverBar && (
            <span className={styles.dim}>收盘倒计时 <span className={styles.mono}>{formatCountdown(remain)}</span></span>
          )}
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
      </div>

      {loadingMore && <div className={styles.loadingMore}>加载更早数据…</div>}
      {loading && <div className={styles.overlay}>加载中…</div>}
      {error && !loading && <div className={`${styles.overlay} ${styles.error}`}>{error}</div>}
    </div>
  );
};

export default LiveChart;
