import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  SeriesType,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import type { ChanCenter, ChanStrokeItem } from '../../services/chanAnalyzeAPI';

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface ChanLayers {
  bi: boolean;
  segment: boolean;
  biCenter: boolean;
  segCenter: boolean;
  /** 中枢内最高 / 最低 gg、dd 虚线 */
  centerRange: boolean;
}

export interface ChanDrawState {
  bis: ChanStrokeItem[];
  segments: ChanStrokeItem[];
  biCenters: ChanCenter[];
  segCenters: ChanCenter[];
  /** 最后一根K线 open_time（毫秒）：进行中的中枢右边界延伸到这里 */
  lastTime: number;
  layers: ChanLayers;
}

export const CHAN_COLORS = {
  bi: '#3b82f6',
  segment: '#f59e0b',
  biCenter: '#a855f7',
  segCenter: '#f97316',
};

// lightweight-charts 不支持时区：时间戳 +8 小时显示北京时间
export const toChartTime = (ms: number) => (Math.floor(ms / 1000) + 8 * 3600) as UTCTimestamp;

const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

/**
 * 缠论结构图元：中枢矩形（最底层）→ 线段粗折线 → 笔细折线。
 * 所有时间都等于某根K线 open_time，直接 timeToCoordinate；坐标每次绘制现算，缩放平移自动跟随。
 */
export class ChanPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: ChanDrawState = {
    bis: [],
    segments: [],
    biCenters: [],
    segCenters: [],
    lastTime: 0,
    layers: { bi: true, segment: true, biCenter: true, segCenter: true, centerRange: false },
  };

  private readonly paneView: IPrimitivePaneView = {
    zOrder: () => 'normal',
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

  setState(next: Partial<ChanDrawState>) {
    this.state = { ...this.state, ...next };
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  private x(ms: number): number | null {
    return this.chart?.timeScale().timeToCoordinate(toChartTime(ms)) ?? null;
  }

  private y(price: number): number | null {
    return this.series?.priceToCoordinate(price) ?? null;
  }

  private draw(target: RenderTarget) {
    if (!this.series || !this.chart) return;
    const { bis, segments, biCenters, segCenters, lastTime, layers } = this.state;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const drawCenters = (list: ChanCenter[], color: string, fillAlpha: number, lineWidth: number) => {
        for (const c of list) {
          const x1 = this.x(c.start_time);
          const x2 = this.x(c.is_completed ? c.end_time : Math.max(c.end_time, lastTime));
          const yTop = this.y(c.zg);
          const yBottom = this.y(c.zd);
          if (x1 === null || x2 === null || yTop === null || yBottom === null) continue;
          const w = Math.max(x2 - x1, 1);
          ctx.fillStyle = withAlpha(color, fillAlpha);
          ctx.fillRect(x1, yTop, w, yBottom - yTop);
          ctx.strokeStyle = withAlpha(color, 0.85);
          ctx.lineWidth = lineWidth;
          // 进行中的中枢用虚线边框
          ctx.setLineDash(c.is_completed ? [] : [6, 4]);
          ctx.strokeRect(x1, yTop, w, yBottom - yTop);

          if (layers.centerRange) {
            const yg = this.y(c.gg);
            const yd = this.y(c.dd);
            ctx.strokeStyle = withAlpha(color, 0.55);
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            if (yg !== null) { ctx.moveTo(x1, yg); ctx.lineTo(x1 + w, yg); }
            if (yd !== null) { ctx.moveTo(x1, yd); ctx.lineTo(x1 + w, yd); }
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
      };

      const drawStrokes = (list: ChanStrokeItem[], color: string, lineWidth: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        for (const s of list) {
          const x1 = this.x(s.start_time);
          const x2 = this.x(s.end_time);
          const y1 = this.y(s.start_price);
          const y2 = this.y(s.end_price);
          if (x1 === null || x2 === null || y1 === null || y2 === null) continue;
          // 未确认（只可能是最后一笔/段）画虚线：还会随新K线延伸
          ctx.setLineDash(s.is_confirmed ? [] : [6, 4]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      };

      if (layers.biCenter) drawCenters(biCenters, CHAN_COLORS.biCenter, 0.08, 1);
      if (layers.segCenter) drawCenters(segCenters, CHAN_COLORS.segCenter, 0.14, 2);
      if (layers.segment) drawStrokes(segments, CHAN_COLORS.segment, 3);
      if (layers.bi) drawStrokes(bis, CHAN_COLORS.bi, 1.5);
    });
  }
}
