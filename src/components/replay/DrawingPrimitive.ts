import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  SeriesType,
  Time,
  Logical,
} from 'lightweight-charts';
import { Anchor, Drawing, HitPart, TimeMapper, FIB_LEVELS, distToSegment, fibPrice, hexToRgba } from './drawings';

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface DrawingState {
  drawings: Drawing[];
  selectedId: string | null;
  /** 正在画的线（第二个点跟随鼠标） */
  preview: Drawing | null;
  mapper: TimeMapper | null;
  /** 文字标签底色（跟随明暗主题），避免压在K线上看不清 */
  labelBg: string;
}

const HIT_TOLERANCE = 6;
const HANDLE_RADIUS = 4;

/**
 * 画线图元：一个图元负责画全部线条，挂在K线 series 上。
 * 坐标在每次绘制时现算（时间→逻辑序号→x，价格→y），所以缩放、平移、切周期、新K线揭示都自动跟随。
 */
export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: DrawingState = { drawings: [], selectedId: null, preview: null, mapper: null, labelBg: 'rgba(17,24,39,0.8)' };

  private readonly paneView: IPrimitivePaneView = {
    zOrder: () => 'top',
    renderer: () => ({ draw: (target: RenderTarget) => this.draw(target) }),
  };

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart as IChartApi;
    this.series = param.series as ISeriesApi<SeriesType>;
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  setState(next: Partial<DrawingState>) {
    this.state = { ...this.state, ...next };
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  // 水平线在价格轴上显示价格标签
  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    const series = this.series;
    if (!series) return [];
    const list = [...this.state.drawings, ...(this.state.preview ? [this.state.preview] : [])];
    return list
      .filter((d): d is Extract<Drawing, { type: 'hline' }> => d.type === 'hline')
      .map((d) => ({
        coordinate: () => series.priceToCoordinate(d.p) ?? -100,
        text: () => series.priceFormatter().format(d.p),
        textColor: () => '#ffffff',
        backColor: () => d.color,
      }));
  }

  // ── 坐标换算 ──

  /**
   * 当前实际的K线间距（像素）。
   * 不能用 options().barSpacing：缩放 / setVisibleLogicalRange 后实际间距和配置值不同
   */
  barSpacing(): number | null {
    const ts = this.chart?.timeScale();
    if (!ts) return null;
    const x0 = ts.logicalToCoordinate(0 as Logical);
    const x1 = ts.logicalToCoordinate(1 as Logical);
    if (x0 === null || x1 === null || x1 === x0) return null;
    return x1 - x0;
  }

  /** 像素 x → 逻辑序号（带小数） */
  xToLogical(x: number): number | null {
    const ts = this.chart?.timeScale();
    const spacing = this.barSpacing();
    if (!ts || spacing === null) return null;
    const x0 = ts.logicalToCoordinate(0 as Logical);
    if (x0 === null) return null;
    return (x - x0) / spacing;
  }

  /**
   * 逻辑序号 → 像素 x。
   * logicalToCoordinate 只接受整数序号（传小数实测返回 0），切周期后锚点多半落在两根K线之间，
   * 所以取相邻两个整数序号的坐标线性插值
   */
  logicalToX(logical: number): number | null {
    const ts = this.chart?.timeScale();
    if (!ts) return null;
    const i = Math.floor(logical);
    const xi = ts.logicalToCoordinate(i as Logical);
    if (xi === null) return null;
    const frac = logical - i;
    if (frac === 0) return xi;
    const xj = ts.logicalToCoordinate((i + 1) as Logical);
    return xj === null ? xi : xi + frac * (xj - xi);
  }

  yToPrice(y: number): number | null {
    return this.series?.coordinateToPrice(y) ?? null;
  }

  anchorToXY(a: Anchor): { x: number; y: number } | null {
    const mapper = this.state.mapper;
    if (!mapper || !this.series) return null;
    const logical = mapper.toLogical(a.t);
    if (logical === null) return null;
    const x = this.logicalToX(logical);
    const y = this.series.priceToCoordinate(a.p);
    if (x === null || y === null) return null;
    return { x, y };
  }

  /** 像素位置 → 锚点；snap=true 时吸附到K线中心 */
  pointToAnchor(x: number, y: number, snap = true): Anchor | null {
    const mapper = this.state.mapper;
    const logical = this.xToLogical(x);
    const p = this.yToPrice(y);
    if (!mapper || logical === null || p === null) return null;
    const t = mapper.toTime(snap ? Math.round(logical) : logical);
    return t === null ? null : { t, p };
  }

  /** 平行通道另一条线的两个端点 */
  private channelPoints(d: Extract<Drawing, { type: 'channel' }>) {
    const pa = this.anchorToXY(d.a);
    const pb = this.anchorToXY(d.b);
    const pa2 = this.anchorToXY({ t: d.a.t, p: d.a.p + d.dp });
    const pb2 = this.anchorToXY({ t: d.b.t, p: d.b.p + d.dp });
    if (!pa || !pb || !pa2 || !pb2) return null;
    return { pa, pb, pa2, pb2, pc: { x: (pa2.x + pb2.x) / 2, y: (pa2.y + pb2.y) / 2 } };
  }

  /** 通道宽度：点 (x, y) 相对基准线 a→b 在同一 x 处的价格差 */
  channelOffsetAt(a: Anchor, b: Anchor, x: number, y: number): number | null {
    const pa = this.anchorToXY(a);
    const pb = this.anchorToXY(b);
    const p = this.yToPrice(y);
    if (!pa || !pb || p === null) return null;
    const k = pb.x === pa.x ? 0 : (x - pa.x) / (pb.x - pa.x);
    const base = this.yToPrice(pa.y + k * (pb.y - pa.y));
    return base === null ? null : p - base;
  }

  // ── 命中检测：选中的线优先，其次后画的在上面 ──
  hitDrawing(x: number, y: number): { id: string; part: HitPart } | null {
    const { drawings, selectedId } = this.state;
    const ordered = [...drawings].reverse().sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
    for (const d of ordered) {
      if (d.type === 'hline') {
        const ly = this.series?.priceToCoordinate(d.p);
        if (ly !== null && ly !== undefined && Math.abs(y - ly) <= HIT_TOLERANCE) return { id: d.id, part: 'body' };
        continue;
      }
      if (d.type === 'channel') {
        const cp = this.channelPoints(d);
        if (!cp) continue;
        const { pa, pb, pa2, pb2, pc } = cp;
        if (Math.hypot(x - pa.x, y - pa.y) <= HANDLE_RADIUS + 3) return { id: d.id, part: 'a' };
        if (Math.hypot(x - pb.x, y - pb.y) <= HANDLE_RADIUS + 3) return { id: d.id, part: 'b' };
        if (Math.hypot(x - pc.x, y - pc.y) <= HANDLE_RADIUS + 3) return { id: d.id, part: 'c' };
        if (distToSegment(x, y, pa.x, pa.y, pb.x, pb.y) <= HIT_TOLERANCE) return { id: d.id, part: 'body' };
        if (distToSegment(x, y, pa2.x, pa2.y, pb2.x, pb2.y) <= HIT_TOLERANCE) return { id: d.id, part: 'body' };
        // 两线之间的带状区域
        if (x >= Math.min(pa.x, pb.x) && x <= Math.max(pa.x, pb.x) && pb.x !== pa.x) {
          const k = (x - pa.x) / (pb.x - pa.x);
          const y1 = pa.y + k * (pb.y - pa.y);
          const y2 = pa2.y + k * (pb2.y - pa2.y);
          if (y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) return { id: d.id, part: 'body' };
        }
        continue;
      }
      const pa = this.anchorToXY(d.a);
      const pb = this.anchorToXY(d.b);
      if (!pa || !pb) continue;
      if (Math.hypot(x - pa.x, y - pa.y) <= HANDLE_RADIUS + 3) return { id: d.id, part: 'a' };
      if (Math.hypot(x - pb.x, y - pb.y) <= HANDLE_RADIUS + 3) return { id: d.id, part: 'b' };
      if (d.type === 'trend') {
        if (distToSegment(x, y, pa.x, pa.y, pb.x, pb.y) <= HIT_TOLERANCE) return { id: d.id, part: 'body' };
      } else if (d.type === 'fib') {
        // 各档水平线从左侧锚点向右延伸；另外斜线也算
        if (distToSegment(x, y, pa.x, pa.y, pb.x, pb.y) <= HIT_TOLERANCE) return { id: d.id, part: 'body' };
        if (x >= Math.min(pa.x, pb.x) - HIT_TOLERANCE) {
          for (const lv of FIB_LEVELS) {
            const ly = this.series?.priceToCoordinate(fibPrice(d.a, d.b, lv));
            if (ly !== null && ly !== undefined && Math.abs(y - ly) <= HIT_TOLERANCE) return { id: d.id, part: 'body' };
          }
        }
      } else {
        const l = Math.min(pa.x, pb.x);
        const r = Math.max(pa.x, pb.x);
        const t = Math.min(pa.y, pb.y);
        const btm = Math.max(pa.y, pb.y);
        if (x >= l - HIT_TOLERANCE && x <= r + HIT_TOLERANCE && y >= t - HIT_TOLERANCE && y <= btm + HIT_TOLERANCE) {
          return { id: d.id, part: 'body' };
        }
      }
    }
    return null;
  }

  // ── 绘制 ──
  private draw(target: RenderTarget) {
    const { drawings, selectedId, preview } = this.state;
    const list = preview ? [...drawings, preview] : drawings;
    if (list.length === 0) return;

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const d of list) {
        const selected = d.id === selectedId || d === preview;
        ctx.save();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = selected ? 2 : 1.5;

        if (d.type === 'hline') {
          const y = this.series?.priceToCoordinate(d.p);
          if (y === null || y === undefined) { ctx.restore(); continue; }
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(mediaSize.width, y);
          ctx.stroke();
          if (selected) this.drawHandle(ctx, mediaSize.width / 2, y, d.color);
          ctx.restore();
          continue;
        }

        if (d.type === 'channel') {
          const cp = this.channelPoints(d);
          if (!cp) { ctx.restore(); continue; }
          const { pa, pb, pa2, pb2, pc } = cp;
          // 填充两线之间
          ctx.fillStyle = hexToRgba(d.color, selected ? 0.14 : 0.08);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.lineTo(pb2.x, pb2.y);
          ctx.lineTo(pa2.x, pa2.y);
          ctx.closePath();
          ctx.fill();
          // 两条边线
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.moveTo(pa2.x, pa2.y);
          ctx.lineTo(pb2.x, pb2.y);
          ctx.stroke();
          // 中轨虚线
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo((pa.x + pa2.x) / 2, (pa.y + pa2.y) / 2);
          ctx.lineTo((pb.x + pb2.x) / 2, (pb.y + pb2.y) / 2);
          ctx.stroke();
          ctx.restore();
          if (selected) {
            this.drawHandle(ctx, pa.x, pa.y, d.color);
            this.drawHandle(ctx, pb.x, pb.y, d.color);
            this.drawHandle(ctx, pc.x, pc.y, d.color);
          }
          ctx.restore();
          continue;
        }

        const pa = this.anchorToXY(d.a);
        const pb = this.anchorToXY(d.b);
        if (!pa || !pb) { ctx.restore(); continue; }

        if (d.type === 'trend') {
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        } else if (d.type === 'fib') {
          this.drawFib(ctx, d, pa, pb, mediaSize.width, selected);
        } else {
          const x = Math.min(pa.x, pb.x);
          const y = Math.min(pa.y, pb.y);
          const w = Math.abs(pb.x - pa.x);
          const h = Math.abs(pb.y - pa.y);
          ctx.fillStyle = hexToRgba(d.color, selected ? 0.18 : 0.12);
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }

        if (selected) {
          this.drawHandle(ctx, pa.x, pa.y, d.color);
          this.drawHandle(ctx, pb.x, pb.y, d.color);
        }
        ctx.restore();
      }
    });
  }

  /** 斐波那契：各档水平线从左锚点延伸到右边缘，左端标比例和价格（不填充背景） */
  private drawFib(
    ctx: CanvasRenderingContext2D,
    d: Extract<Drawing, { type: 'fib' }>,
    pa: { x: number; y: number },
    pb: { x: number; y: number },
    width: number,
    selected: boolean,
  ) {
    const series = this.series;
    if (!series) return;
    const left = Math.min(pa.x, pb.x);
    const ys = FIB_LEVELS.map((lv) => series.priceToCoordinate(fibPrice(d.a, d.b, lv)));

    // 水平线 + 标签
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'bottom';
    FIB_LEVELS.forEach((lv, i) => {
      const y = ys[i];
      if (y === null) return;
      const key = lv === 0 || lv === 1;
      ctx.globalAlpha = key ? 1 : 0.7;
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      const text = `${lv} (${series.priceFormatter().format(fibPrice(d.a, d.b, lv))})`;
      const tw = ctx.measureText(text).width;
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.state.labelBg;
      ctx.fillRect(left + 2, y - 15, tw + 6, 13);
      ctx.fillStyle = d.color;
      ctx.fillText(text, left + 5, y - 3);
    });
    ctx.globalAlpha = 1;

    // 两个锚点之间的虚线斜线，看清从哪量到哪
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.beginPath();
    ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}
