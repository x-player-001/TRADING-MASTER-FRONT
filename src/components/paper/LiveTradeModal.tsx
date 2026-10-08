import React, { useEffect, useRef, useState } from 'react';
import { Alert, Collapse, Modal, Segmented, Table, Tag } from 'antd';
import { createChart, createSeriesMarkers, CandlestickSeries, HistogramSeries, LineStyle } from 'lightweight-charts';
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import dayjs from 'dayjs';
import {
  liveTradingAPI,
  LiveTrade,
  LiveTradeDetail,
  LIVE_STATUS_LABELS,
  LIVE_EXIT_REASON_LABELS,
  LIVE_EVENT_LABELS,
  liveReasonLabel,
} from '../../services/liveTradingAPI';
import { PAPER_STATUS_LABELS, PAPER_EXIT_REASON_LABELS, PAPER_CANCEL_REASON_LABELS } from '../../services/paperTradingAPI';
import { fmtPrice, fmtTime, fmtU, fmtR, pnlClass } from './paperFormat';
import { liveStatusColor } from './liveFormat';
import styles from './Paper.module.scss';

interface LiveTradeModalProps {
  /** 列表里的那一行，先用它显示标题，K线按 id 另取 */
  trade: LiveTrade | null;
  strategyName?: string;
  isDark: boolean;
  onClose: () => void;
}

const UP = '#26a69a';
const DOWN = '#ef5350';
const C_ENTRY = '#3b82f6';
const C_SIGNAL = '#8b5cf6';
const C_SETUP = '#f59e0b';
const INTERVALS = ['5m', '15m', '1h', '4h'];
const TF_MS: Record<string, number> = { '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 60 * 60_000, '4h': 4 * 60 * 60_000 };

// lightweight-charts 不支持时区：时间戳 +8 小时显示北京时间
const toChartTime = (ms: number) => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

const LEVEL_STYLE: Record<string, { title: string; color: string; style: LineStyle }> = {
  entry_trigger: { title: '触发', color: C_ENTRY, style: LineStyle.Dashed },
  entry_limit: { title: 'IOC限价', color: C_ENTRY, style: LineStyle.Dotted },
  base_stop: { title: '新高', color: '#94a3b8', style: LineStyle.Dotted },
  stop: { title: '止损', color: DOWN, style: LineStyle.Dashed },
  take_profit: { title: '止盈', color: UP, style: LineStyle.Dashed },
};

/** 滑点：做空成交价比模拟盘低 / 做多成交价比模拟盘高为不利 */
const slippage = (live: number | null, paper: number | null, side: 'short' | 'long'): React.ReactNode => {
  if (!live || !paper) return '—';
  const diff = ((live - paper) / paper) * 100;
  const adverse = side === 'short' ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 1e-9) return '无滑点';
  return <span className={adverse ? styles.neg : styles.pos}>{diff > 0 ? '+' : ''}{diff.toFixed(3)}% {adverse ? '不利' : '有利'}</span>;
};

/** 实盘 vs 模拟盘：成交价差就是滑点；一边成交一边没有就是漏单 */
const ComparePanel: React.FC<{ live: LiveTrade; paper: LiveTradeDetail['paper_trade'] }> = ({ live, paper }) => {
  if (!paper) return <div className={styles.dim}>模拟盘没有这笔信号</div>;
  const liveFilled = live.fill_price !== null;
  const paperFilled = paper.fill_price !== null;
  const rows = [
    {
      k: '状态',
      live: LIVE_STATUS_LABELS[live.status] ?? live.status,
      paper: PAPER_STATUS_LABELS[paper.status] ?? paper.status,
      diff: liveFilled !== paperFilled ? <Tag color="error">{liveFilled ? '模拟盘未成交' : '实盘漏单'}</Tag> : '',
    },
    { k: '成交时间', live: fmtTime(live.fill_time), paper: fmtTime(paper.fill_time), diff: '' },
    { k: '成交价', live: fmtPrice(live.fill_price), paper: fmtPrice(paper.fill_price), diff: slippage(live.fill_price, paper.fill_price, live.side) },
    {
      k: '平仓',
      live: live.exit_reason ? `${fmtPrice(live.exit_price)} · ${LIVE_EXIT_REASON_LABELS[live.exit_reason] ?? live.exit_reason}` : liveReasonLabel(live.cancel_reason) || '—',
      paper: paper.exit_reason
        ? `${fmtPrice(paper.exit_price)} · ${PAPER_EXIT_REASON_LABELS[paper.exit_reason] ?? paper.exit_reason}`
        : (paper.cancel_reason && (PAPER_CANCEL_REASON_LABELS[paper.cancel_reason] ?? paper.cancel_reason)) || '—',
      diff: slippage(live.exit_price, paper.exit_price, live.side === 'short' ? 'long' : 'short'),
    },
    {
      k: '净盈亏',
      live: <span className={styles[pnlClass(live.pnl)]}>{fmtU(live.pnl, true)}</span>,
      paper: <span className={styles[pnlClass(paper.pnl)]}>{fmtU(paper.pnl, true)}</span>,
      diff: live.pnl !== null && paper.pnl !== null ? <span className={styles[pnlClass(live.pnl - paper.pnl)]}>{fmtU(live.pnl - paper.pnl, true)}</span> : '',
    },
    { k: 'R', live: fmtR(live.r_multiple), paper: fmtR(paper.r_multiple), diff: '' },
  ];
  return (
    <Table
      size="small"
      rowKey="k"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: '', dataIndex: 'k', width: 90 },
        { title: '实盘', dataIndex: 'live' },
        { title: `模拟盘 #${paper.id}`, dataIndex: 'paper' },
        { title: '差异（实盘相对模拟盘）', dataIndex: 'diff' },
      ]}
    />
  );
};

const LiveTradeModal: React.FC<LiveTradeModalProps> = ({ trade, strategyName, isDark, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<LiveTradeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = 策略周期
  const [interval, setInterval_] = useState<string | null>(null);
  const tradeId = trade?.id;

  // 换一笔时回到策略周期
  useEffect(() => { setInterval_(null); }, [tradeId]);

  useEffect(() => {
    if (!tradeId) { setDetail(null); return; }
    let stale = false;
    setLoading(true);
    setError(null);
    liveTradingAPI
      .getTrade(tradeId, { interval: interval ?? undefined })
      .then((d) => { if (!stale) setDetail(d); })
      .catch((err) => { if (!stale) setError((err as Error).message || '加载失败'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [tradeId, interval]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !detail || detail.trade.id !== tradeId) return;
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

    // 价位线：止损和新高相同时只画止损
    const levels = detail.levels ?? [];
    const stopPrice = levels.find((l) => l.kind === 'stop')?.price;
    for (const l of levels) {
      if (l.price === null || l.price === undefined) continue;
      if (l.kind === 'base_stop' && stopPrice === l.price) continue;
      const st = LEVEL_STYLE[l.kind] ?? { title: l.kind, color: '#94a3b8', style: LineStyle.Dotted };
      candle.createPriceLine({ price: l.price, color: st.color, title: st.title, lineStyle: st.style, lineWidth: 1, axisLabelVisible: true });
    }
    if (t.status === 'open' && t.fill_price) {
      candle.createPriceLine({ price: t.fill_price, color: C_ENTRY, title: '成交', lineStyle: LineStyle.Solid, lineWidth: 1, axisLabelVisible: true });
    }

    // 时间点：按所选周期向下取整对齐到所在K线（UTC 分桶）
    const step = TF_MS[detail.interval] ?? TF_MS['5m'];
    const align = (ms: number) => Math.floor(ms / step) * step;
    const first = klines[0].open_time;
    const last = klines[klines.length - 1].open_time;
    const isShort = t.side === 'short';
    const markers: SeriesMarker<Time>[] = [];
    for (const m of detail.markers ?? []) {
      const at = align(m.time);
      if (at < first || at > last) continue;
      let mk: Omit<SeriesMarker<Time>, 'time'>;
      if (m.kind === 'trigger') mk = { position: 'aboveBar', shape: 'circle', color: C_SIGNAL, text: '背离' };
      else if (m.kind === 'setup') mk = { position: 'aboveBar', shape: 'square', color: C_SETUP, text: '反转' };
      else if (m.kind === 'entry') {
        mk = { position: isShort ? 'aboveBar' : 'belowBar', shape: isShort ? 'arrowDown' : 'arrowUp', color: C_ENTRY, text: isShort ? '开空' : '开多' };
      } else if (m.kind === 'exit') {
        mk = {
          position: isShort ? 'belowBar' : 'aboveBar',
          shape: isShort ? 'arrowUp' : 'arrowDown',
          color: (t.pnl ?? 0) >= 0 ? UP : DOWN,
          text: LIVE_EXIT_REASON_LABELS[m.reason ?? t.exit_reason ?? ''] ?? '平仓',
        };
      } else mk = { position: 'aboveBar', shape: 'circle', color: '#94a3b8', text: m.kind };
      markers.push({ time: toChartTime(at), ...mk } as SeriesMarker<Time>);
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(candle, markers);

    const focusFrom = klines.findIndex((k) => k.open_time >= align(t.trigger_time));
    chart.timeScale().setVisibleLogicalRange({ from: Math.max((focusFrom >= 0 ? focusFrom : 0) - 60, 0), to: klines.length + 6 });

    const observer = new ResizeObserver(() => {
      if (container.clientWidth > 0) chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [detail, tradeId, isDark]);

  const t = detail && detail.trade.id === tradeId ? detail.trade : trade;
  const events = detail?.events ?? [];

  return (
    <Modal
      open={!!trade}
      onCancel={onClose}
      footer={null}
      width={1120}
      destroyOnHidden
      title={
        t && (
          <span className={styles.modalTitle}>
            <span className={styles.symbol}>{t.symbol}</span>
            <Tag color="purple">{t.timeframe}</Tag>
            <Tag color={t.side === 'short' ? 'red' : 'green'}>{t.side === 'short' ? '做空' : '做多'}</Tag>
            <Tag color={liveStatusColor(t.status)}>{LIVE_STATUS_LABELS[t.status] ?? t.status}</Tag>
            {t.entry_mode && <Tag>{t.entry_mode === 'ioc' ? '直接 IOC' : '条件单'}</Tag>}
            <span className={styles.dim}>{strategyName ?? t.strategy_id} · #{t.id}</span>
          </span>
        )
      }
    >
      {t?.status === 'error' && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message="这笔交易需要人工处理，处理前不会开新仓" description={t.error_msg || undefined} />
      )}
      {t && (
        <div className={styles.detailGrid}>
          <div><span className={styles.kLabel}>背离触发</span>{fmtTime(t.trigger_time)}</div>
          <div><span className={styles.kLabel}>挂单</span>{fmtTime(t.signal_time)}</div>
          <div><span className={styles.kLabel}>触发 / 限价</span>{fmtPrice(t.entry_trigger)} / {fmtPrice(t.entry_limit)}</div>
          <div><span className={styles.kLabel}>止损 / 止盈</span>{fmtPrice(t.stop_price)} / {fmtPrice(t.take_profit)}</div>
          <div><span className={styles.kLabel}>数量</span>{t.filled_qty ?? '—'} / 计划 {t.planned_qty ?? '—'}</div>
          <div><span className={styles.kLabel}>杠杆 / 风险</span>{t.leverage ? `${t.leverage}x` : '—'} / {fmtU(t.risk_usdt)}U</div>
          <div><span className={styles.kLabel}>成交</span>{t.fill_time ? `${fmtPrice(t.fill_price)} · ${fmtTime(t.fill_time)}` : '—'}</div>
          <div>
            <span className={styles.kLabel}>平仓</span>
            {t.exit_time
              ? `${fmtPrice(t.exit_price)} · ${LIVE_EXIT_REASON_LABELS[t.exit_reason ?? ''] ?? t.exit_reason ?? ''}`
              : t.status === 'open' ? `最新 ${fmtPrice(t.last_price)}` : liveReasonLabel(t.cancel_reason) || '—'}
          </div>
          <div>
            <span className={styles.kLabel}>{t.status === 'open' ? '浮动盈亏' : '净盈亏'}</span>
            {t.status === 'open' ? (
              <span className={styles[pnlClass(t.unrealized_pnl)]}>{fmtU(t.unrealized_pnl, true)} · {fmtR(t.unrealized_r)}</span>
            ) : (
              <span className={styles[pnlClass(t.pnl)]}>{fmtU(t.pnl, true)} · {fmtR(t.r_multiple)}</span>
            )}
          </div>
          <div><span className={styles.kLabel}>毛盈亏</span>{fmtU(t.gross_pnl, true)}</div>
          <div><span className={styles.kLabel}>手续费 / 资金费</span>{fmtU(t.fees)} / {fmtU(t.funding, true)}</div>
          <div><span className={styles.kLabel}>MFE / MAE</span>{fmtR(t.mfe_r)} / {fmtR(t.mae_r)}</div>
        </div>
      )}

      <div className={styles.chartToolbar}>
        <Segmented
          size="small"
          value={detail?.interval ?? interval ?? t?.timeframe ?? '5m'}
          onChange={(v) => setInterval_(String(v))}
          options={INTERVALS}
          disabled={loading}
        />
        <span className={styles.dim}>{loading && detail ? '加载中…' : `${detail?.klines?.length ?? 0} 根 · 时间为北京时间`}</span>
      </div>
      <div className={styles.modalChart} ref={containerRef}>
        {loading && !detail && <div className={styles.chartHint}>加载K线…</div>}
        {error && <div className={styles.chartHint}>{error}</div>}
        {detail && !detail.klines?.length && <div className={styles.chartHint}>无K线数据</div>}
      </div>

      {detail && t && (
        <Collapse
          size="small"
          className={styles.sectionGap}
          defaultActiveKey={['compare']}
          items={[
            { key: 'compare', label: '对比模拟盘（成交价差 = 滑点，一边成交一边没有 = 漏单）', children: <ComparePanel live={t} paper={detail.paper_trade} /> },
            {
              key: 'events',
              label: `执行流水 ${events.length}`,
              children: events.length ? (
                <div className={styles.eventList}>
                  {events.map((e) => (
                    <div key={e.id} className={styles.eventRow}>
                      <span className={styles.dim}>{dayjs(e.created_at).format('MM-DD HH:mm:ss.SSS')}</span>
                      <span className={/error|failed|rejected|insufficient/.test(e.kind) ? styles.neg : undefined}>
                        {LIVE_EVENT_LABELS[e.kind] ?? e.kind}
                      </span>
                      {e.payload !== null && e.payload !== undefined && (
                        <code className={styles.eventPayload}>{typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload)}</code>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className={styles.dim}>暂无流水</span>
              ),
            },
          ]}
        />
      )}
    </Modal>
  );
};

export default LiveTradeModal;
