import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Segmented, Tag, Tooltip } from 'antd';
import { createChart, createSeriesMarkers, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import {
  strategyBacktestAPI,
  BacktestTradeDetail,
  BacktestTradeFilters,
} from '../../services/strategyBacktestAPI';
import { AnnotationPrimitive, ShapeAnnotation } from './AnnotationPrimitive';
import { fmtPrice, fmtTime, fmtU, fmtR, pnlClass } from './paperFormat';
import { fmtPct, fmtFeature, featureLabel } from './backtestFormat';
import styles from './Paper.module.scss';

interface BacktestTradeModalProps {
  /** 当前查看的交易 id，null 为关闭 */
  tradeId: number | null;
  /** 与列表相同的筛选条件：后端据此算上一笔 / 下一笔 */
  filters: BacktestTradeFilters;
  exitReasons: Record<string, string>;
  strategyName?: string;
  isDark: boolean;
  onNavigate: (id: number) => void;
  onClose: () => void;
}

const INTERVAL_KEY = 'paper.backtest.interval';
const FALLBACK_INTERVALS = ['5m', '15m', '1h', '4h'];

const readInterval = (): string | null => {
  try {
    return localStorage.getItem(INTERVAL_KEY);
  } catch {
    return null;
  }
};

const UP = '#26a69a';
const DOWN = '#ef5350';

// lightweight-charts 不支持时区：时间戳 +8 小时显示北京时间
const toChartTime = (ms: number) => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

// 后端 color 是建议值，没给时按标注文字取色
const defaultColor = (label = ''): string => {
  if (label.includes('拉升')) return '#22c55e';
  if (label.includes('区间')) return '#8b5cf6';
  if (label.includes('挂单')) return '#3b82f6';
  if (label.includes('爆仓') || label.includes('止损')) return '#ef4444';
  if (label.includes('目标')) return '#16a34a';
  return '#f59e0b';
};

const BacktestTradeModal: React.FC<BacktestTradeModalProps> = ({
  tradeId,
  filters,
  exitReasons,
  strategyName,
  isDark,
  onNavigate,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<BacktestTradeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 选中的周期在翻页和下次打开时保留；null = 用交易本身的周期
  const [interval, setInterval_] = useState<string | null>(readInterval);
  const filtersKey = JSON.stringify(filters);

  const changeInterval = (iv: string) => {
    setInterval_(iv);
    try { localStorage.setItem(INTERVAL_KEY, iv); } catch { /* 忽略 */ }
  };

  useEffect(() => {
    if (!tradeId) {
      setDetail(null);
      return;
    }
    let stale = false;
    setLoading(true);
    setError(null);
    strategyBacktestAPI
      .getTrade(tradeId, { ...JSON.parse(filtersKey), interval: interval ?? undefined })
      .then((d) => { if (!stale) setDetail(d); })
      .catch((err) => { if (!stale) setError((err as Error).message || '加载失败'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [tradeId, filtersKey, interval]);

  // 键盘 ← / → 翻上一笔 / 下一笔
  useEffect(() => {
    if (!tradeId || !detail) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && detail.prev_id) onNavigate(detail.prev_id);
      if (e.key === 'ArrowRight' && detail.next_id) onNavigate(detail.next_id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tradeId, detail, onNavigate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !detail || detail.trade.id !== tradeId) return;
    const klines = (detail.klines ?? []).slice().sort((a, b) => a.open_time - b.open_time);
    if (!klines.length) return;
    const t = detail.trade;
    const annotations = t.annotations ?? [];

    const bg = isDark ? '#111827' : '#ffffff';
    const textColor = isDark ? '#d1d5db' : '#1f2937';
    const gridColor = isDark ? '#1f2937' : '#eef0f4';
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 440,
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 8, borderColor: gridColor },
      rightPriceScale: { borderColor: gridColor },
      crosshair: { mode: 0 },
    });
    const ref = klines[klines.length - 1].close;
    const precision = ref >= 1000 ? 2 : ref >= 1 ? 4 : ref >= 0.01 ? 6 : 8;
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
      priceFormat: { type: 'price', precision, minMove: 1 / 10 ** precision },
      priceLineVisible: false,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    candle.setData(klines.map((k) => ({ time: toChartTime(k.open_time), open: k.open, high: k.high, low: k.low, close: k.close })));
    volume.setData(klines.map((k) => ({
      time: toChartTime(k.open_time),
      value: k.volume,
      color: k.close >= k.open ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)',
    })));

    // 矩形 / 水平线 / 折线
    const shapes = annotations.filter((a): a is ShapeAnnotation => a.type !== 'marker');
    const prim = new AnnotationPrimitive();
    candle.attachPrimitive(prim);
    prim.setState({
      items: shapes,
      barTimes: klines.map((k) => k.open_time),
      labelBg: isDark ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.85)',
      colorOf: (a) => defaultColor(a.label),
    });

    // 点标记：只打在有K线的时间上
    const barSet = new Set(klines.map((k) => k.open_time));
    const markers: SeriesMarker<Time>[] = [];
    for (const a of annotations) {
      if (a.type !== 'marker' || !barSet.has(a.time)) continue;
      const above = a.position ? a.position === 'above' : a.role === 'exit';
      let shape: SeriesMarker<Time>['shape'] = 'circle';
      let color = a.color || '#f59e0b';
      if (a.role === 'entry') {
        shape = t.side === 'short' ? 'arrowDown' : 'arrowUp';
        color = a.color || '#3b82f6';
      } else if (a.role === 'exit') {
        shape = t.side === 'short' ? 'arrowUp' : 'arrowDown';
        color = (t.pnl ?? 0) > 0 ? UP : DOWN;
      }
      markers.push({ time: toChartTime(a.time), position: above ? 'aboveBar' : 'belowBar', shape, color, text: a.label ?? '' } as SeriesMarker<Time>);
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(candle, markers);

    // 视野：标注覆盖范围前后各留一点
    const times = annotations.flatMap((a) =>
      a.type === 'marker' ? [a.time] : a.type === 'segment' ? a.points.map((p) => p.time) : [a.from_time, a.to_time]
    );
    if (times.length) {
      const lo = Math.min(...times);
      const hi = Math.max(...times);
      const i1 = klines.findIndex((k) => k.open_time >= lo);
      let i2 = klines.findIndex((k) => k.open_time >= hi);
      if (i2 < 0) i2 = klines.length - 1;
      const pad = Math.max(20, Math.round((i2 - i1) * 0.25));
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(i1 - pad, 0), to: Math.min(i2 + pad, klines.length + 8) });
    } else {
      chart.timeScale().fitContent();
    }

    const observer = new ResizeObserver(() => {
      if (container.clientWidth > 0) chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [detail, tradeId, isDark]);

  const t = detail?.trade;
  const features = t?.features ? Object.entries(t.features).filter(([, v]) => v !== null && v !== undefined) : [];
  const reason = t?.exit_reason ? exitReasons[t.exit_reason] ?? t.exit_reason : null;

  return (
    <Modal
      open={tradeId !== null}
      onCancel={onClose}
      footer={null}
      width={1120}
      destroyOnHidden
      title={
        <span className={styles.modalTitle}>
          {t ? (
            <>
              <span className={styles.symbol}>{t.symbol}</span>
              <Tag color="purple">{t.timeframe}</Tag>
              <Tag color={t.side === 'short' ? 'red' : 'green'}>{t.side === 'short' ? '做空' : '做多'}</Tag>
              <Tag color={t.status === 'closed' ? 'default' : 'gold'}>{t.status === 'closed' ? '已平仓' : '未成交'}</Tag>
              {reason && <span className={styles.dim}>{reason}</span>}
              <span className={styles.dim}>{strategyName}</span>
            </>
          ) : (
            <span>交易 #{tradeId}</span>
          )}
          <span className={styles.navBtns}>
            <Tooltip title="上一笔（更早，←）">
              <Button size="small" disabled={!detail?.prev_id || loading} onClick={() => detail?.prev_id && onNavigate(detail.prev_id)}>
                ← 上一笔
              </Button>
            </Tooltip>
            <Tooltip title="下一笔（更晚，→）">
              <Button size="small" disabled={!detail?.next_id || loading} onClick={() => detail?.next_id && onNavigate(detail.next_id)}>
                下一笔 →
              </Button>
            </Tooltip>
          </span>
        </span>
      }
    >
      {t && (
        <div className={styles.detailGrid}>
          <div><span className={styles.kLabel}>信号</span>{fmtTime(t.signal_time, true)}</div>
          <div><span className={styles.kLabel}>入场</span>{t.entry_time ? `${fmtPrice(t.entry_price)} · ${fmtTime(t.entry_time)}` : '未成交'}</div>
          <div>
            <span className={styles.kLabel}>{t.status === 'unfilled' ? '挂单到期' : '出场'}</span>
            {t.exit_time ? `${t.status === 'closed' ? `${fmtPrice(t.exit_price)} · ` : ''}${fmtTime(t.exit_time)}` : '—'}
          </div>
          <div><span className={styles.kLabel}>目标价</span>{fmtPrice(t.target_price)}</div>
          <div><span className={styles.kLabel}>止损</span>{t.stop_price !== null ? fmtPrice(t.stop_price) : '未设'}</div>
          <div>
            <span className={styles.kLabel}>净盈亏</span>
            <span className={styles[pnlClass(t.pnl)]}>
              {fmtU(t.pnl, true)}U · {fmtPct(t.pnl_pct)}{t.r_multiple !== null ? ` · ${fmtR(t.r_multiple)}` : ''}
            </span>
          </div>
          <div><span className={styles.kLabel}>MFE / MAE</span>{fmtPct(t.mfe_pct)} / {fmtPct(t.mae_pct)}</div>
          <div><span className={styles.kLabel}>持仓</span>{t.bars_held !== null ? `${t.bars_held} 根` : '—'}</div>
        </div>
      )}

      <div className={styles.chartToolbar}>
        <Segmented
          size="small"
          value={detail?.interval ?? interval ?? t?.timeframe ?? '5m'}
          onChange={(v) => changeInterval(String(v))}
          options={detail?.intervals?.length ? detail.intervals : FALLBACK_INTERVALS}
          disabled={loading}
        />
        <span className={styles.dim}>
          {loading && detail ? '加载中…' : `${detail?.klines?.length ?? 0} 根${detail?.interval && t && detail.interval !== t.timeframe ? ` · 交易周期 ${t.timeframe}，标注已对齐到 ${detail.interval}` : ''}`}
        </span>
      </div>
      <div className={styles.modalChart} ref={containerRef}>
        {loading && !detail && <div className={styles.chartHint}>加载K线…</div>}
        {error && <div className={styles.chartHint}>{error}</div>}
        {detail && !detail.klines?.length && <div className={styles.chartHint}>无K线数据</div>}
      </div>
      <div className={styles.legend}>
        <span className={styles.dim}>时间为北京时间 · ← / → 翻看上一笔 / 下一笔（与列表筛选一致）</span>
      </div>

      {features.length > 0 && (
        <div className={styles.features}>
          {features.map(([k, v]) => (
            <span key={k} className={styles.featureTag} title={k}>
              <span className={styles.dim}>{featureLabel(k)}</span> {fmtFeature(k, v)}
            </span>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default BacktestTradeModal;
