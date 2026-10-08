import React, { useEffect, useRef, useState } from 'react';
import { Modal, Tag } from 'antd';
import { createChart, createSeriesMarkers, CandlestickSeries, HistogramSeries, LineStyle } from 'lightweight-charts';
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import {
  paperTradingAPI,
  PaperTrade,
  PaperTradeDetail,
  PAPER_STATUS_LABELS,
  PAPER_EXIT_REASON_LABELS,
  PAPER_CANCEL_REASON_LABELS,
} from '../../services/paperTradingAPI';
import { fmtPrice, fmtTime, fmtU, fmtR, pnlClass, statusColor } from './paperFormat';
import styles from './Paper.module.scss';

interface PaperTradeModalProps {
  /** 列表里的那一行，先用它显示标题，K线按 id 另取 */
  trade: PaperTrade | null;
  strategyName?: string;
  isDark: boolean;
  onClose: () => void;
}

const UP = '#26a69a';
const DOWN = '#ef5350';
const C_ENTRY = '#3b82f6';
const C_SIGNAL = '#8b5cf6';
const C_SETUP = '#f59e0b';

const TF_MS: Record<string, number> = { '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 60 * 60_000 };

// lightweight-charts 不支持时区：时间戳 +8 小时显示北京时间
const toChartTime = (ms: number) => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

const FEATURE_LABELS: [string, string, (v: number) => string][] = [
  ['imp_pct', '前波涨幅', (v) => `${v.toFixed(1)}%`],
  ['leg_pct', '末段涨幅', (v) => `${v.toFixed(1)}%`],
  ['dif_ratio', 'DIF 比', (v) => v.toFixed(3)],
  ['hist_ratio', '红柱比', (v) => v.toFixed(3)],
  ['gap', '翻绿根数', (v) => String(v)],
  ['gdep', '绿柱深度', (v) => v.toFixed(3)],
  ['qv24_m', '24h 成交额', (v) => `${v.toFixed(1)}M`],
  ['qv_surge', '放量倍数', (v) => `${v.toFixed(2)}x`],
  ['atr_pct', 'ATR%', (v) => `${v.toFixed(2)}%`],
  ['range48', '48根振幅', (v) => v.toFixed(2)],
  ['wait', '等待根数', (v) => String(v)],
  ['wick', '上影', (v) => v.toFixed(3)],
  ['body', '实体', (v) => v.toFixed(3)],
];

const PaperTradeModal: React.FC<PaperTradeModalProps> = ({ trade, strategyName, isDark, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<PaperTradeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tradeId = trade?.id;

  useEffect(() => {
    if (!tradeId) return;
    let stale = false;
    setDetail(null);
    setError(null);
    setLoading(true);
    paperTradingAPI
      .getTrade(tradeId, { bars_before: 120, bars_after: 30 })
      .then((d) => { if (!stale) setDetail(d); })
      .catch((err) => { if (!stale) setError((err as Error).message || '加载失败'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [tradeId]);

  // 画图：Modal 打开后容器才有尺寸，等 detail 到了再建
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !detail) return;
    const klines = (detail.klines ?? []).slice().sort((a, b) => a.open_time - b.open_time);
    if (!klines.length) return;
    const t = detail.trade;

    const bg = isDark ? '#111827' : '#ffffff';
    const textColor = isDark ? '#d1d5db' : '#1f2937';
    const gridColor = isDark ? '#1f2937' : '#eef0f4';
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 420,
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 6, borderColor: gridColor },
      rightPriceScale: { borderColor: gridColor },
      crosshair: { mode: 0 },
    });
    const ref = klines[klines.length - 1].close;
    const precision = ref >= 1000 ? 2 : ref >= 1 ? 4 : ref >= 0.01 ? 6 : 8;
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
      priceFormat: { type: 'price', precision, minMove: 1 / 10 ** precision },
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    candle.setData(klines.map((k) => ({ time: toChartTime(k.open_time), open: k.open, high: k.high, low: k.low, close: k.close })));
    volume.setData(klines.map((k) => ({
      time: toChartTime(k.open_time),
      value: k.volume,
      color: k.close >= k.open ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)',
    })));

    // 价格线：触发价 / 止损 / 止盈
    const line = (price: number | null, color: string, title: string, style = LineStyle.Dashed) => {
      if (price === null || price === undefined) return;
      candle.createPriceLine({ price, color, title, lineStyle: style, lineWidth: 1, axisLabelVisible: true });
    };
    line(t.entry_trigger, C_ENTRY, '触发');
    line(t.stop_price ?? t.base_stop, DOWN, t.stop_price !== null ? '止损' : '新高');
    line(t.take_profit, UP, '止盈');
    if (t.status === 'open' && t.fill_price) line(t.fill_price, C_ENTRY, '成交', LineStyle.Solid);

    // 标记：fill/exit 是 5m 的 open_time，15m 图按 UTC 向下取整对齐到所在K线
    const step = TF_MS[detail.timeframe] ?? TF_MS['5m'];
    const align = (ms: number) => Math.floor(ms / step) * step;
    const first = klines[0].open_time;
    const last = klines[klines.length - 1].open_time;
    const isShort = t.side === 'short';
    const markers: SeriesMarker<Time>[] = [];
    const mark = (ms: number | null, m: Omit<SeriesMarker<Time>, 'time'>) => {
      if (!ms) return;
      const at = align(ms);
      if (at < first || at > last) return;
      markers.push({ time: toChartTime(at), ...m } as SeriesMarker<Time>);
    };
    mark(t.trigger_time, { position: 'aboveBar', shape: 'circle', color: C_SIGNAL, text: '背离' });
    mark(t.setup_time, { position: 'aboveBar', shape: 'square', color: C_SETUP, text: '反转' });
    mark(t.fill_time, {
      position: isShort ? 'aboveBar' : 'belowBar',
      shape: isShort ? 'arrowDown' : 'arrowUp',
      color: C_ENTRY,
      text: isShort ? '开空' : '开多',
    });
    mark(t.exit_time, {
      position: isShort ? 'belowBar' : 'aboveBar',
      shape: isShort ? 'arrowUp' : 'arrowDown',
      color: (t.pnl ?? 0) >= 0 ? UP : DOWN,
      text: PAPER_EXIT_REASON_LABELS[t.exit_reason ?? ''] ?? '平仓',
    });
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(candle, markers);

    // 默认把背离点到平仓（或最新）放在视野里
    const focusFrom = klines.findIndex((k) => k.open_time >= align(t.trigger_time));
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max((focusFrom >= 0 ? focusFrom : 0) - 60, 0),
      to: klines.length + 6,
    });

    const observer = new ResizeObserver(() => {
      if (container.clientWidth > 0) chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [detail, isDark]);

  const t = detail?.trade ?? trade;
  const features = t?.features ?? null;

  return (
    <Modal
      open={!!trade}
      onCancel={onClose}
      footer={null}
      width={1080}
      destroyOnHidden
      title={
        t && (
          <span className={styles.modalTitle}>
            <span className={styles.symbol}>{t.symbol}</span>
            <Tag color="purple">{t.timeframe}</Tag>
            <Tag color={t.side === 'short' ? 'red' : 'green'}>{t.side === 'short' ? '做空' : '做多'}</Tag>
            <Tag color={statusColor(t.status)}>{PAPER_STATUS_LABELS[t.status] ?? t.status}</Tag>
            <span className={styles.dim}>{strategyName ?? t.strategy_id}</span>
          </span>
        )
      }
    >
      {t && (
        <div className={styles.detailGrid}>
          <div><span className={styles.kLabel}>背离触发</span>{fmtTime(t.trigger_time)}</div>
          <div><span className={styles.kLabel}>挂单</span>{fmtTime(t.signal_time)}</div>
          <div><span className={styles.kLabel}>触发价</span>{fmtPrice(t.entry_trigger)}</div>
          <div><span className={styles.kLabel}>止损</span>{fmtPrice(t.stop_price ?? t.base_stop)}</div>
          <div><span className={styles.kLabel}>止盈</span>{fmtPrice(t.take_profit)}</div>
          <div><span className={styles.kLabel}>成交</span>{t.fill_time ? `${fmtPrice(t.fill_price)} · ${fmtTime(t.fill_time)}` : '—'}</div>
          <div>
            <span className={styles.kLabel}>平仓</span>
            {t.exit_time
              ? `${fmtPrice(t.exit_price)} · ${PAPER_EXIT_REASON_LABELS[t.exit_reason ?? ''] ?? t.exit_reason ?? ''}`
              : t.status === 'open' ? `最新 ${fmtPrice(t.last_price)}` : '—'}
          </div>
          <div>
            <span className={styles.kLabel}>{t.status === 'open' ? '浮动盈亏' : '净盈亏'}</span>
            {t.status === 'open' ? (
              <span className={styles[pnlClass(t.unrealized_pnl)]}>{fmtU(t.unrealized_pnl, true)} · {fmtR(t.unrealized_r)}</span>
            ) : (
              <span className={styles[pnlClass(t.pnl)]}>{fmtU(t.pnl, true)} · {fmtR(t.r_multiple)}</span>
            )}
          </div>
          <div><span className={styles.kLabel}>名义价值</span>{t.notional !== null ? `${fmtU(t.notional)}U` : '—'}</div>
          <div><span className={styles.kLabel}>手续费</span>{fmtU(t.fees)}</div>
          <div><span className={styles.kLabel}>MFE / MAE</span>{fmtR(t.mfe_r)} / {fmtR(t.mae_r)}</div>
          {t.cancel_reason && (
            <div><span className={styles.kLabel}>原因</span>{PAPER_CANCEL_REASON_LABELS[t.cancel_reason] ?? t.cancel_reason}</div>
          )}
        </div>
      )}

      <div className={styles.modalChart} ref={containerRef}>
        {loading && <div className={styles.chartHint}>加载K线…</div>}
        {error && <div className={styles.chartHint}>{error}</div>}
        {!loading && !error && detail && !detail.klines?.length && <div className={styles.chartHint}>无K线数据</div>}
      </div>
      <div className={styles.legend}>
        <span style={{ color: C_SIGNAL }}>● 背离</span>
        <span style={{ color: C_SETUP }}>■ 反转K线</span>
        <span style={{ color: C_ENTRY }}>┄ 触发价</span>
        <span style={{ color: DOWN }}>┄ 止损</span>
        <span style={{ color: UP }}>┄ 止盈</span>
        <span className={styles.dim}>时间为北京时间</span>
      </div>

      {features && (
        <div className={styles.features}>
          {FEATURE_LABELS.filter(([k]) => features[k] !== null && features[k] !== undefined).map(([k, label, fmt]) => (
            <span key={k} className={styles.featureTag}>
              <span className={styles.dim}>{label}</span> {fmt(Number(features[k]))}
            </span>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default PaperTradeModal;
