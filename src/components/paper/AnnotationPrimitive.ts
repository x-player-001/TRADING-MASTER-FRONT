import type {
  AutoscaleInfo,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  SeriesType,
  Time,
  Logical,
  UTCTimestamp,
} from 'lightweight-charts';
import type { BacktestAnnotation } from '../../services/strategyBacktestAPI';

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

/** box / hline / segment 由图元画；marker 走 createSeriesMarkers */
export type ShapeAnnotation = Exclude<BacktestAnnotation, { type: 'marker' }>;

export interface AnnotationState {
  items: ShapeAnnotation[];
  /** K线 open_time（毫秒，升序）：时间不在K线上时按最近一根换算 */
  barTimes: number[];
  labelBg: string;
  /** 未给 color 时的默认色 */
  colorOf: (a: ShapeAnnotation) => string;
}

// lightweight-charts 不支持时区：时间戳 +8 小时显示北京时间
const toChartTime = (ms: number) => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

const withAlpha = (color: string, alpha: number) => {
  const h = color.replace('#', '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(h)) return color;
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

/**
 * 回测标注图元：整理区间（矩形）、限价/目标/爆仓价（水平线段）、拉升段（折线），文字贴在图形左上 / 右端。
 * 坐标每次绘制时现算，缩放平移自动跟随。
 */
export class AnnotationPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: AnnotationState = { items: [], barTimes: [], labelBg: 'rgba(17,24,39,0.8)', colorOf: () => '#3b82f6' };

  private readonly paneView: IPrimitivePaneView = {
    zOrder: () => 'bottom',
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

  setState(next: Partial<AnnotationState>) {
    this.state = { ...this.state, ...next };
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  /** 让价格轴把目标价、爆仓价这类远离K线的水平线也纳入可视范围 */
  autoscaleInfo(): AutoscaleInfo | null {
    const prices: number[] = [];
    for (const a of this.state.items) {
      if (a.type === 'hline') prices.push(a.price);
      else if (a.type === 'box') prices.push(a.top, a.bottom);
      else a.points.forEach((p) => prices.push(p.price));
    }
    const finite = prices.filter(Number.isFinite);
    if (!finite.length) return null;
    return { priceRange: { minValue: Math.min(...finite), maxValue: Math.max(...finite) } };
  }

  /** 时间 → x：先按K线时间直接换算；不在K线上时取最近一根的整数序号（小数序号会被当成 0） */
  private x(ms: number): number | null {
    const ts = this.chart?.timeScale();
    if (!ts) return null;
    const direct = ts.timeToCoordinate(toChartTime(ms));
    if (direct !== null) return direct;
    const bars = this.state.barTimes;
    if (!bars.length) return null;
    let lo = 0;
    let hi = bars.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bars[mid] < ms) lo = mid + 1;
      else hi = mid;
    }
    const idx = lo > 0 && Math.abs(bars[lo - 1] - ms) < Math.abs(bars[lo] - ms) ? lo - 1 : lo;
    return ts.logicalToCoordinate(idx as Logical);
  }

  private y(price: number): number | null {
    return this.series?.priceToCoordinate(price) ?? null;
  }

  private draw(target: RenderTarget) {
    const { items, labelBg, colorOf } = this.state;
    if (!items.length || !this.series) return;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';

      const label = (text: string | undefined, x: number, y: number, color: string, align: 'left' | 'right' = 'left') => {
        if (!text) return;
        const w = ctx.measureText(text).width + 8;
        const left = align === 'left' ? x : x - w;
        ctx.fillStyle = labelBg;
        ctx.fillRect(left, y - 8, w, 16);
        ctx.fillStyle = color;
        ctx.fillText(text, left + 4, y);
      };

      // 先画矩形，再画线，标签最后画在最上面
      const order = [...items].sort((a, b) => (a.type === 'box' ? 0 : 1) - (b.type === 'box' ? 0 : 1));
      for (const a of order) {
        const color = a.color || colorOf(a);
        if (a.type === 'box') {
          const x1 = this.x(a.from_time);
          const x2 = this.x(a.to_time);
          const y1 = this.y(a.top);
          const y2 = this.y(a.bottom);
          if (x1 === null || x2 === null || y1 === null || y2 === null) continue;
          ctx.fillStyle = withAlpha(color, 0.1);
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
          ctx.strokeStyle = withAlpha(color, 0.7);
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          label(a.label, x1 + 2, y1 + 10, color);
        } else if (a.type === 'hline') {
          const x1 = this.x(a.from_time);
          const x2 = this.x(a.to_time);
          const y = this.y(a.price);
          if (x1 === null || x2 === null || y === null) continue;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash(a.style === 'dashed' ? [5, 4] : []);
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(Math.max(x2, x1 + 1), y);
          ctx.stroke();
          ctx.setLineDash([]);
          label(a.label, x2 + 4, y, color);
        } else if (a.type === 'segment') {
          const pts = a.points
            .map((p) => ({ x: this.x(p.time), y: this.y(p.price) }))
            .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
          if (pts.length < 2) continue;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.stroke();
          const mid = pts[Math.floor((pts.length - 1) / 2)];
          const next = pts[Math.floor((pts.length - 1) / 2) + 1];
          label(a.label, (mid.x + next.x) / 2 + 6, (mid.y + next.y) / 2, color);
        }
      }
    });
  }
}
