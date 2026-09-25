import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  ISeriesMarkersPluginApi,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import {
  ReplayBar,
  ReplayFill,
  ReplayInterval,
  ReplayOrder,
  INTERVAL_MS,
} from '../../services/replayAPI';
import type { OpenPosition } from './useReplaySession';
import styles from './Replay.module.scss';
import { fmtPrice } from './format';
import { DrawingPrimitive } from './DrawingPrimitive';
import { CountdownPrimitive, countdownText } from './CountdownPrimitive';
import { calcEMA, calcMACD } from './indicators';
import {
  Drawing,
  DrawingTool,
  HitPart,
  TimeMapper,
  DRAWING_COLORS,
  newId,
  loadDrawings,
  saveDrawings,
} from './drawings';

interface ReplayChartProps {
  bars: ReplayBar[];
  interval: ReplayInterval;
  fills: ReplayFill[];
  position: OpenPosition | null;
  pendingOrders: ReplayOrder[];
  isDark: boolean;
  /** 点击图表时回传该位置的价格（用于填入委托价/止损/止盈） */
  onPriceClick?: (price: number) => void;
  /** 当前是否处于「点图取价」状态，用十字光标提示 */
  picking?: boolean;
  /** 画线按这个 key 存浏览器本地（按会话区分），不传则不启用画线 */
  drawingKey?: string;
  /**
   * 拖动图上的止损/止盈线后回调新价格，返回错误信息（校验不通过）或 null。
   * 不传则止损止盈线不可拖动（如会话已结束）
   */
  onProtectionDrag?: (kind: 'sl' | 'tp', price: number) => string | null;
  /** 游标 5m K线的 open_time：大周期下在价格轴显示当前K线的剩余时间 */
  cursorTime?: number;
  /** 主图叠加 EMA20 */
  showEma?: boolean;
  /** 副图 MACD(12,26,9) */
  showMacd?: boolean;
}

const EMA_PERIOD = 20;
const EMA_COLOR = '#f59e0b';
const DIF_COLOR = '#3b82f6';
const DEA_COLOR = '#f59e0b';
const MACD_PANE = 1;

/** 指标数值精度跟随价格量级，小币种的 MACD 不至于全显示成 0.00 */
const precisionFor = (price: number) => (price >= 1000 ? 2 : price >= 1 ? 4 : 6);

type ProtectionKind = 'sl' | 'tp';

/** 止损/止盈线的标签：按该价格平掉全部持仓的盈亏（未扣手续费） */
const protectionTitle = (kind: ProtectionKind, price: number, position: OpenPosition) => {
  const sign = position.direction === 'long' ? 1 : -1;
  const pnl = (price - position.avg_entry_price) * position.qty * sign;
  return `${kind === 'sl' ? '止损' : '止盈'} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}U`;
};

const TOOLS: { tool: DrawingTool; icon: string; title: string }[] = [
  { tool: 'select', icon: '↖', title: '选择 / 拖动（Esc）' },
  { tool: 'hline', icon: '─', title: '水平线：点一下放置' },
  { tool: 'trend', icon: '╱', title: '趋势线：依次点两个点' },
  { tool: 'channel', icon: '⫽', title: '平行通道：先点两个点画基准线，再点一下定宽度' },
  { tool: 'rect', icon: '▭', title: '矩形：依次点对角两个点' },
  { tool: 'fib', icon: 'Fib', title: '斐波那契：从波段起点点到终点（起点=0，终点=1，1.5/2 向外延伸）' },
];

interface DragState {
  id: string;
  part: HitPart;
  startX: number;
  startY: number;
  orig: Drawing;
}

// lightweight-charts 不支持时区：时间戳 +8 小时显示北京时间
const toChartTime = (ms: number): UTCTimestamp => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

const UP = '#26a69a';
const DOWN = '#ef5350';

const toCandle = (b: ReplayBar) => ({
  time: toChartTime(b.open_time),
  open: b.open,
  high: b.high,
  low: b.low,
  close: b.close,
});

const toVolume = (b: ReplayBar) => ({
  time: toChartTime(b.open_time),
  value: b.volume,
  color: b.close >= b.open ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)',
});

// 成交打点文案：方向 + 动作
const fillLabel = (f: ReplayFill): string => {
  const isBuy = f.side === 'buy';
  switch (f.action) {
    case 'open': return isBuy ? '开多' : '开空';
    case 'add': return isBuy ? '加多' : '加空';
    case 'reduce': return isBuy ? '减空' : '减多';
    case 'close': return isBuy ? '平空' : '平多';
    default: return isBuy ? '买' : '卖';
  }
};

const ORDER_TYPE_LABEL: Record<string, string> = { limit: '限价', stop: '条件', market: '市价' };

const ReplayChart: React.FC<ReplayChartProps> = ({
  bars,
  interval,
  fills,
  position,
  pendingOrders,
  isDark,
  onPriceClick,
  picking = false,
  drawingKey,
  onProtectionDrag,
  cursorTime,
  showEma = true,
  showMacd = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<DrawingPrimitive | null>(null);
  const countdownRef = useRef<CountdownPrimitive | null>(null);
  const emaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdRef = useRef<{ hist: ISeriesApi<'Histogram'>; dif: ISeriesApi<'Line'>; dea: ISeriesApi<'Line'> } | null>(null);

  // ── 画线状态 ──
  // drawings 用 { key, list } 绑定会话，避免切换会话时把旧会话的线存进新会话
  const [drawingState, setDrawingState] = useState<{ key: string | undefined; list: Drawing[] }>(() => ({
    key: drawingKey,
    list: drawingKey ? loadDrawings(drawingKey) : [],
  }));
  const [tool, setTool] = useState<DrawingTool>('select');
  const [color, setColor] = useState(DRAWING_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 多点画线进行到第几步：0=未开始，1=已点第一个点，2=通道已定基准线、正在定宽度
  const [pendingStage, setPendingStage] = useState(0);
  const pendingStageRef = useRef(0);
  const setStage = useCallback((n: number) => {
    pendingStageRef.current = n;
    setPendingStage(n);
  }, []);
  const drawings = useMemo(
    () => (drawingState.key === drawingKey ? drawingState.list : []),
    [drawingState, drawingKey]
  );

  // 事件处理里读最新值，避免闭包拿到旧状态
  const drawingsRef = useRef<Drawing[]>(drawings);
  drawingsRef.current = drawings;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;
  const previewRef = useRef<Drawing | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  // 止损/止盈线单独记一份，拖动时直接改它们的价格和标签
  const protectionLinesRef = useRef<Partial<Record<ProtectionKind, IPriceLine>>>({});
  const positionRef = useRef(position);
  positionRef.current = position;
  const onProtectionDragRef = useRef(onProtectionDrag);
  onProtectionDragRef.current = onProtectionDrag;
  const protectionDragRef = useRef<{ kind: ProtectionKind; orig: number; price: number } | null>(null);
  // 记录上次渲染的数据，用于判断能否增量 update
  const renderedRef = useRef<{ interval: ReplayInterval; firstTime: number; length: number } | null>(null);
  const onPriceClickRef = useRef(onPriceClick);
  onPriceClickRef.current = onPriceClick;

  // 创建图表（主题变化时重建）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bg = isDark ? '#111827' : '#ffffff';
    const textColor = isDark ? '#d1d5db' : '#1f2937';
    const gridColor = isDark ? '#1f2937' : '#eef0f4';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 8, borderColor: gridColor },
      rightPriceScale: { borderColor: gridColor },
      crosshair: { mode: 0 },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chart.subscribeClick((param) => {
      // 只在主图取价：MACD 副图的纵坐标不是价格
      if (!param.point || !onPriceClickRef.current || (param.paneIndex ?? 0) !== 0) return;
      const price = candle.coordinateToPrice(param.point.y);
      if (price !== null) onPriceClickRef.current(price);
    });

    const drawingPrimitive = new DrawingPrimitive();
    candle.attachPrimitive(drawingPrimitive);
    drawingRef.current = drawingPrimitive;

    emaRef.current = chart.addSeries(LineSeries, {
      color: EMA_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const countdownPrimitive = new CountdownPrimitive();
    candle.attachPrimitive(countdownPrimitive);
    countdownRef.current = countdownPrimitive;

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    markersRef.current = createSeriesMarkers(candle, []);
    renderedRef.current = null;
    priceLinesRef.current = [];

    const observer = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      markersRef.current = null;
      drawingRef.current = null;
      countdownRef.current = null;
      emaRef.current = null;
      macdRef.current = null;
    };
  }, [isDark]);

  // ── 指标：EMA20 叠加主图，MACD 放副图；每次整段重算（几千根 O(n)，开销很小） ──
  useEffect(() => {
    const chart = chartRef.current;
    const ema = emaRef.current;
    if (!chart || !ema) return;
    const times = bars.map((b) => toChartTime(b.open_time));
    const closes = bars.map((b) => b.close);
    const precision = precisionFor(closes[closes.length - 1] ?? 1);
    const minMove = 1 / 10 ** precision;
    const toLine = (vals: (number | null)[]) =>
      vals.flatMap((v, i) => (v === null ? [] : [{ time: times[i], value: v }]));

    ema.applyOptions({ visible: showEma, priceFormat: { type: 'price', precision, minMove } });
    ema.setData(showEma ? toLine(calcEMA(closes, EMA_PERIOD)) : []);

    if (!showMacd) {
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
        dif: chart.addSeries(LineSeries, { ...common, color: DIF_COLOR, lineWidth: 1, title: 'DIF' }, MACD_PANE),
        dea: chart.addSeries(LineSeries, { ...common, color: DEA_COLOR, lineWidth: 1, title: 'DEA' }, MACD_PANE),
      };
      // 主图 : 副图 ≈ 3 : 1
      chart.panes()[0]?.setStretchFactor(3);
      chart.panes()[MACD_PANE]?.setStretchFactor(1);
    }
    const { hist, dif, dea } = macdRef.current;
    const fmt = { priceFormat: { type: 'price' as const, precision, minMove } };
    hist.applyOptions(fmt);
    dif.applyOptions(fmt);
    dea.applyOptions(fmt);
    const m = calcMACD(closes);
    // 柱子：零轴上绿下红，比前一根缩短时颜色变淡
    hist.setData(
      m.hist.flatMap((v, i) => {
        if (v === null) return [];
        const prev = m.hist[i - 1] ?? null;
        const weakening = prev !== null && Math.abs(v) < Math.abs(prev);
        const color = v >= 0
          ? (weakening ? 'rgba(38,166,154,0.45)' : UP)
          : (weakening ? 'rgba(239,83,80,0.45)' : DOWN);
        return [{ time: times[i], value: v, color }];
      })
    );
    dif.setData(toLine(m.dif));
    dea.setData(toLine(m.dea));
  }, [bars, showEma, showMacd, isDark]);

  // 价格轴倒计时：跟最新价标签同色，贴在它下方
  useEffect(() => {
    const last = bars[bars.length - 1];
    countdownRef.current?.setState({
      price: last ? last.close : null,
      text: last && cursorTime ? countdownText(cursorTime, INTERVAL_MS[interval], INTERVAL_MS['5m']) : '',
      color: last && last.close < last.open ? DOWN : UP,
    });
  }, [bars, interval, cursorTime, isDark]);

  // K线数据：同一周期且只在尾部变化时增量 update，否则整段 setData
  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candle || !volume || !chart) return;

    const prev = renderedRef.current;
    const firstTime = bars[0]?.open_time ?? 0;
    const canIncrement =
      prev &&
      prev.interval === interval &&
      prev.firstTime === firstTime &&
      bars.length >= prev.length &&
      bars.length - prev.length < 50;

    if (canIncrement && prev) {
      // 上一次的最后一根可能被更新（大周期未收盘），从它开始往后 update
      for (let i = Math.max(prev.length - 1, 0); i < bars.length; i++) {
        candle.update(toCandle(bars[i]));
        volume.update(toVolume(bars[i]));
      }
    } else {
      candle.setData(bars.map(toCandle));
      volume.setData(bars.map(toVolume));
      // 切周期或首次加载：显示最近 150 根
      if (bars.length > 0) {
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(bars.length - 150, 0), to: bars.length + 8 });
      }
    }
    renderedRef.current = { interval, firstTime, length: bars.length };
  }, [bars, interval, isDark]);

  // 成交打点：bar_time 是 5m 时间，按当前周期向下取整对齐到所在K线
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;
    const step = INTERVAL_MS[interval];
    const first = bars[0]?.open_time ?? Infinity;
    const last = bars[bars.length - 1]?.open_time ?? -Infinity;
    const list: SeriesMarker<Time>[] = fills
      .map((f) => ({ f, t: Math.floor(f.bar_time / step) * step }))
      .filter(({ t }) => t >= first && t <= last)
      .sort((a, b) => a.t - b.t)
      .map(({ f, t }) => {
        const isBuy = f.side === 'buy';
        return {
          time: toChartTime(t),
          position: isBuy ? 'belowBar' : 'aboveBar',
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          color: isBuy ? UP : DOWN,
          text: fillLabel(f),
        } as SeriesMarker<Time>;
      });
    markers.setMarkers(list);
  }, [fills, bars, interval, isDark]);

  // 价格线：持仓均价 / 止损 / 止盈 / 挂单
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    priceLinesRef.current.forEach((l) => candle.removePriceLine(l));
    const lines: IPriceLine[] = [];
    const add = (price: number | null, color: string, title: string, style: LineStyle, width: 1 | 2 = 1) => {
      if (price === null || price === undefined) return null;
      const line = candle.createPriceLine({ price, color, title, lineStyle: style, lineWidth: width, axisLabelVisible: true });
      lines.push(line);
      return line;
    };
    protectionLinesRef.current = {};
    if (position) {
      add(position.avg_entry_price, '#3b82f6', position.direction === 'long' ? '多 均价' : '空 均价', LineStyle.Solid);
      // 止损止盈线加粗一点，方便拖动
      const sl = position.stop_loss === null ? null : add(position.stop_loss, DOWN, protectionTitle('sl', position.stop_loss, position), LineStyle.Dashed, 2);
      const tp = position.take_profit === null ? null : add(position.take_profit, UP, protectionTitle('tp', position.take_profit, position), LineStyle.Dashed, 2);
      if (sl) protectionLinesRef.current.sl = sl;
      if (tp) protectionLinesRef.current.tp = tp;
    }
    for (const o of pendingOrders) {
      add(o.price, '#a855f7', `${ORDER_TYPE_LABEL[o.order_type] ?? ''}${o.side === 'buy' ? '买' : '卖'}`, LineStyle.Dotted);
    }
    priceLinesRef.current = lines;
  }, [position, pendingOrders, isDark]);

  // ════════════════ 画线 ════════════════
  const mapperRef = useRef<TimeMapper | null>(null);

  const cancelPending = useCallback(() => {
    previewRef.current = null;
    setStage(0);
    drawingRef.current?.setState({ preview: null });
  }, [setStage]);

  // 切换会话：读取该会话自己的画线
  useEffect(() => {
    setDrawingState({ key: drawingKey, list: drawingKey ? loadDrawings(drawingKey) : [] });
    setSelectedId(null);
    setTool('select');
    cancelPending();
  }, [drawingKey, cancelPending]);

  const commit = useCallback((list: Drawing[]) => {
    drawingsRef.current = list;
    setDrawingState({ key: drawingKey, list });
    if (drawingKey) saveDrawings(drawingKey, list);
  }, [drawingKey]);

  // 同步到图元：线条 / 选中 / 当前周期的时间换算
  useEffect(() => {
    const mapper = new TimeMapper(bars, INTERVAL_MS[interval]);
    mapperRef.current = mapper;
    drawingRef.current?.setState({
      drawings,
      selectedId,
      mapper,
      preview: previewRef.current,
      labelBg: isDark ? 'rgba(17,24,39,0.8)' : 'rgba(255,255,255,0.85)',
    });
  }, [drawings, selectedId, bars, interval, isDark]);

  // 鼠标交互：mousedown 用捕获阶段拦截，画线/拖动时不让图表平移
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !drawingKey) return;

    const localPoint = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const chart = chartRef.current;
      if (!chart) return { x, y, inPane: false };
      const paneW = chart.timeScale().width();
      // 只算主图窗格：下面可能还有 MACD 副图
      const paneH = chart.paneSize(0).height;
      return { x, y, inPane: x >= 0 && x <= paneW && y >= 0 && y <= paneH };
    };

    /** y 附近是否有可拖动的止损/止盈线 */
    const hitProtection = (y: number): ProtectionKind | null => {
      const pos = positionRef.current;
      const candle = candleRef.current;
      if (!pos || !candle || !onProtectionDragRef.current) return null;
      for (const kind of ['sl', 'tp'] as const) {
        const price = kind === 'sl' ? pos.stop_loss : pos.take_profit;
        if (price === null) continue;
        const ly = candle.priceToCoordinate(price);
        if (ly !== null && Math.abs(ly - y) <= 5) return kind;
      }
      return null;
    };

    // 拖动中的新位置
    const moveDrawing = (drag: DragState, x: number, y: number): Drawing => {
      const prim = drawingRef.current;
      const mapper = mapperRef.current;
      const chart = chartRef.current;
      const { orig } = drag;
      if (!prim || !mapper || !chart) return orig;
      const p0 = prim.yToPrice(drag.startY);
      const p1 = prim.yToPrice(y);
      if (p0 === null || p1 === null) return orig;
      const dP = p1 - p0;
      if (orig.type === 'hline') return { ...orig, p: orig.p + dP };
      // 通道宽度手柄：只改平行线的偏移
      if (drag.part === 'c') return orig.type === 'channel' ? { ...orig, dp: orig.dp + dP } : orig;
      if (drag.part !== 'body') {
        const anchor = prim.pointToAnchor(x, y);
        return anchor ? { ...orig, [drag.part]: anchor } : orig;
      }
      // 整体平移：时间按整根K线移动，价格连续
      const spacing = prim.barSpacing();
      if (spacing === null) return orig;
      const dL = Math.round((x - drag.startX) / spacing);
      const shift = (a: { t: number; p: number }) => {
        const l = mapper.toLogical(a.t);
        const t = l === null ? null : mapper.toTime(l + dL);
        return { t: t ?? a.t, p: a.p + dP };
      };
      return { ...orig, a: shift(orig.a), b: shift(orig.b) };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || pickingRef.current) return; // 点图取价优先
      const prim = drawingRef.current;
      if (!prim) return;
      const { x, y, inPane } = localPoint(e);
      if (!inPane) return;
      const block = () => { e.preventDefault(); e.stopPropagation(); };
      const t = toolRef.current;

      // 选择模式下，止损/止盈线优先于画线：按住拖动改价格
      if (t === 'select') {
        const kind = hitProtection(y);
        const pos = positionRef.current;
        if (kind && pos) {
          const orig = (kind === 'sl' ? pos.stop_loss : pos.take_profit) as number;
          protectionDragRef.current = { kind, orig, price: orig };
          chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
          block();
          return;
        }
      }

      if (t === 'hline') {
        const p = prim.yToPrice(y);
        if (p === null) return;
        const d: Drawing = { id: newId(), type: 'hline', p, color: colorRef.current };
        commit([...drawingsRef.current, d]);
        setSelectedId(d.id);
        setTool('select');
        block();
        return;
      }

      if (t === 'channel') {
        const pv = previewRef.current;
        if (!pv || pv.type !== 'channel') {
          const anchor = prim.pointToAnchor(x, y);
          if (!anchor) return;
          previewRef.current = { id: newId(), type: 'channel', a: anchor, b: anchor, dp: 0, color: colorRef.current };
          setStage(1);
        } else if (pendingStageRef.current === 1) {
          // 第二个点：定下基准线，接下来移动鼠标定宽度
          const anchor = prim.pointToAnchor(x, y);
          if (!anchor) return;
          previewRef.current = { ...pv, b: anchor };
          setStage(2);
        } else {
          const dp = prim.channelOffsetAt(pv.a, pv.b, x, y);
          const d: Drawing = { ...pv, dp: dp ?? pv.dp };
          cancelPending();
          commit([...drawingsRef.current, d]);
          setSelectedId(d.id);
          setTool('select');
          block();
          return;
        }
        prim.setState({ preview: previewRef.current });
        block();
        return;
      }

      if (t === 'trend' || t === 'rect' || t === 'fib') {
        const anchor = prim.pointToAnchor(x, y);
        if (!anchor) return;
        const pv = previewRef.current;
        if (!pv) {
          previewRef.current = { id: newId(), type: t, a: anchor, b: anchor, color: colorRef.current };
          setStage(1);
          prim.setState({ preview: previewRef.current });
        } else if (pv.type !== 'hline') {
          const d: Drawing = { ...pv, b: anchor };
          cancelPending();
          commit([...drawingsRef.current, d]);
          setSelectedId(d.id);
          setTool('select');
        }
        block();
        return;
      }

      // 选择模式：点中线条则选中并开始拖动，点空白处取消选中（不拦截，图表照常平移）
      const hit = prim.hitDrawing(x, y);
      if (!hit) {
        if (selectedRef.current) setSelectedId(null);
        return;
      }
      const orig = drawingsRef.current.find((d) => d.id === hit.id);
      if (!orig) return;
      setSelectedId(hit.id);
      dragRef.current = { id: hit.id, part: hit.part, startX: x, startY: y, orig };
      chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
      block();
    };

    const onContainerMove = (e: MouseEvent) => {
      if (dragRef.current) return;
      const prim = drawingRef.current;
      if (!prim) return;
      const { x, y, inPane } = localPoint(e);
      const pv = previewRef.current;
      if (pv && pv.type === 'channel' && pendingStageRef.current === 2) {
        const dp = prim.channelOffsetAt(pv.a, pv.b, x, y);
        if (dp !== null) {
          previewRef.current = { ...pv, dp };
          prim.setState({ preview: previewRef.current });
        }
        return;
      }
      if (pv && pv.type !== 'hline') {
        const anchor = prim.pointToAnchor(x, y);
        if (anchor) {
          previewRef.current = { ...pv, b: anchor };
          prim.setState({ preview: previewRef.current });
        }
        return;
      }
      if (toolRef.current === 'select' && !pickingRef.current) {
        container.style.cursor = !inPane ? '' : hitProtection(y) ? 'ns-resize' : prim.hitDrawing(x, y) ? 'move' : '';
      }
    };

    // 拖动期间只更新图元，松手再提交保存，避免每帧重渲染
    const onWindowMove = (e: MouseEvent) => {
      const pd = protectionDragRef.current;
      if (pd) {
        const candle = candleRef.current;
        const pos = positionRef.current;
        const line = protectionLinesRef.current[pd.kind];
        const price = candle?.coordinateToPrice(localPoint(e).y);
        if (candle && pos && line && price !== null && price !== undefined && price > 0) {
          pd.price = Number(fmtPrice(price));
          line.applyOptions({ price: pd.price, title: protectionTitle(pd.kind, pd.price, pos) });
        }
        return;
      }
      const drag = dragRef.current;
      const prim = drawingRef.current;
      if (!drag || !prim) return;
      const { x, y } = localPoint(e);
      const next = moveDrawing(drag, x, y);
      const list = drawingsRef.current.map((d) => (d.id === drag.id ? next : d));
      drawingsRef.current = list;
      prim.setState({ drawings: list });
    };

    const onWindowUp = () => {
      const pd = protectionDragRef.current;
      if (pd) {
        protectionDragRef.current = null;
        chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
        if (pd.price === pd.orig) return;
        const handler = onProtectionDragRef.current;
        const error = handler ? handler(pd.kind, pd.price) : '会话已结束，不能修改';
        if (error) {
          // 校验不通过：线退回原位
          message.error(error);
          const pos = positionRef.current;
          const line = protectionLinesRef.current[pd.kind];
          if (pos && line) line.applyOptions({ price: pd.orig, title: protectionTitle(pd.kind, pd.orig, pos) });
        }
        return;
      }
      if (!dragRef.current) return;
      dragRef.current = null;
      chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
      commit(drawingsRef.current);
    };

    container.addEventListener('mousedown', onMouseDown, true);
    container.addEventListener('mousemove', onContainerMove);
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
    return () => {
      container.removeEventListener('mousedown', onMouseDown, true);
      container.removeEventListener('mousemove', onContainerMove);
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
    };
  }, [drawingKey, commit, cancelPending, setStage, isDark]);

  // 键盘：Delete/Backspace 删除选中，Esc 取消画线并回到选择
  useEffect(() => {
    if (!drawingKey) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        e.preventDefault();
        commit(drawingsRef.current.filter((d) => d.id !== selectedRef.current));
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        cancelPending();
        setTool('select');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawingKey, commit, cancelPending]);

  const chooseTool = (t: DrawingTool) => {
    cancelPending();
    setTool(t);
    if (t !== 'select') setSelectedId(null);
  };

  // 选中线条时换色直接改这条线，否则只影响之后新画的
  const chooseColor = (c: string) => {
    setColor(c);
    if (selectedId) commit(drawings.map((d) => (d.id === selectedId ? { ...d, color: c } : d)));
  };

  // 一键清除：不弹确认，给 5 秒撤销
  const clearAll = () => {
    const prev = drawings;
    if (prev.length === 0) return;
    commit([]);
    setSelectedId(null);
    cancelPending();
    const key = `replay-clear-${Date.now()}`;
    message.open({
      key,
      type: 'info',
      duration: 5,
      content: (
        <span>
          已清除 {prev.length} 条画线
          <a
            style={{ marginLeft: 12 }}
            onClick={() => {
              commit(prev);
              message.destroy(key);
            }}
          >
            撤销
          </a>
        </span>
      ),
    });
  };

  const hint =
    tool === 'hline' ? '点击放置水平线'
      : tool === 'channel'
        ? pendingStage === 0 ? '点击基准线第一个点'
          : pendingStage === 1 ? '点击基准线第二个点，Esc 取消'
            : '移动鼠标调整通道宽度，点击完成'
        : tool === 'fib' ? (pendingStage ? '点击波段终点（1 位），Esc 取消' : '点击波段起点（0 位）')
          : tool === 'trend' || tool === 'rect' ? (pendingStage ? '点击第二个点，Esc 取消' : '点击第一个点')
          : '';

  return (
    <div className={styles.chartWrap}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', cursor: picking || tool !== 'select' ? 'crosshair' : undefined }}
      />
      {drawingKey && (
        <div className={styles.drawToolbar}>
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              type="button"
              className={`${styles.drawBtn} ${t.icon.length > 1 ? styles.drawBtnText : ''} ${tool === t.tool ? styles.drawBtnOn : ''}`}
              title={t.title}
              onClick={() => chooseTool(t.tool)}
            >
              {t.icon}
            </button>
          ))}
          <span className={styles.drawSep} />
          {DRAWING_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.swatch} ${color === c ? styles.swatchOn : ''}`}
              style={{ background: c }}
              title={selectedId ? '修改选中线条颜色' : '新画线条的颜色'}
              onClick={() => chooseColor(c)}
            />
          ))}
          <span className={styles.drawSep} />
          <button
            type="button"
            className={styles.drawBtn}
            disabled={!selectedId}
            title="删除选中（Delete）"
            onClick={() => {
              commit(drawings.filter((d) => d.id !== selectedId));
              setSelectedId(null);
            }}
          >
            🗑
          </button>
          <button
            type="button"
            className={`${styles.drawBtn} ${styles.drawBtnText}`}
            disabled={drawings.length === 0}
            title="一键清除本会话全部画线（5 秒内可撤销）"
            onClick={clearAll}
          >
            清除
          </button>
          {hint && <span className={styles.drawHint}>{hint}</span>}
        </div>
      )}
    </div>
  );
};

export default ReplayChart;
