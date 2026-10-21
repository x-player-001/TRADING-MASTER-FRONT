import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';

type CanvasRenderingTarget2D = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface MeasurePoint {
  /** 逻辑序号（整数，logicalToCoordinate 不认小数） */
  logical: number;
  price: number;
}

export interface MeasureState {
  from: MeasurePoint;
  to: MeasurePoint;
  /** 标签每行一段文字 */
  lines: string[];
}

const UP_COLOR = '#2962ff';
const DOWN_COLOR = '#ef5350';
const FONT = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const LINE_HEIGHT = 16;
const PAD = 6;
const ARROW = 5;

/**
 * Shift + 拖动的测量框（类似 TradingView）：区间矩形 + 横竖箭头 + 涨跌/根数/时长标签。
 * 用逻辑序号和价格定位，图表平移缩放时跟着走
 */
export class MeasurePrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: MeasureState | null = null;

  private readonly renderer: IPrimitivePaneRenderer = {
    draw: (target: CanvasRenderingTarget2D) => {
      const s = this.state;
      const chart = this.chart;
      const series = this.series;
      if (!s || !chart || !series) return;
      const ts = chart.timeScale();
      const x1 = ts.logicalToCoordinate(s.from.logical as Logical);
      const x2 = ts.logicalToCoordinate(s.to.logical as Logical);
      const y1 = series.priceToCoordinate(s.from.price);
      const y2 = series.priceToCoordinate(s.to.price);
      if (x1 === null || x2 === null || y1 === null || y2 === null) return;

      target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
        const up = s.to.price >= s.from.price;
        const color = up ? UP_COLOR : DOWN_COLOR;
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const midX = (left + right) / 2;
        const midY = (top + bottom) / 2;

        ctx.save();
        ctx.fillStyle = up ? 'rgba(41,98,255,0.16)' : 'rgba(239,83,80,0.16)';
        ctx.fillRect(left, top, right - left, bottom - top);

        // 竖箭头：起点价 → 终点价；横箭头：起点 → 终点
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.moveTo(x1, midY);
        ctx.lineTo(x2, midY);
        ctx.stroke();
        const head = (x: number, y: number, dx: number, dy: number) => {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - dx * ARROW - dy * ARROW, y - dy * ARROW - dx * ARROW);
          ctx.lineTo(x - dx * ARROW + dy * ARROW, y - dy * ARROW + dx * ARROW);
          ctx.closePath();
          ctx.fill();
        };
        if (Math.abs(y2 - y1) > ARROW * 2) head(midX, y2, 0, Math.sign(y2 - y1));
        if (Math.abs(x2 - x1) > ARROW * 2) head(x2, midY, Math.sign(x2 - x1), 0);

        // 标签：涨在框上方，跌在框下方，放不下就翻到另一侧
        ctx.font = FONT;
        const w = Math.max(...s.lines.map((l) => ctx.measureText(l).width)) + PAD * 2;
        const h = s.lines.length * LINE_HEIGHT + PAD;
        const lx = Math.min(Math.max(midX - w / 2, 2), mediaSize.width - w - 2);
        let ly = up ? top - h - 6 : bottom + 6;
        if (ly < 2) ly = bottom + 6;
        if (ly + h > mediaSize.height - 2) ly = Math.max(2, top - h - 6);
        ctx.beginPath();
        ctx.roundRect(lx, ly, w, h, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        s.lines.forEach((l, i) => ctx.fillText(l, lx + w / 2, ly + PAD / 2 + 2 + i * LINE_HEIGHT));
        ctx.restore();
      });
    },
  };

  private readonly paneView: IPrimitivePaneView = {
    zOrder: () => 'top',
    renderer: () => this.renderer,
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

  setState(next: MeasureState | null) {
    this.state = next;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
