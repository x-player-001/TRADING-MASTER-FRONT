import type {
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';

// 最新价标签的高度（默认 12px 字号）：倒计时标签贴在它正下方
const PRICE_LABEL_HEIGHT = 18;

export interface CountdownState {
  /** 最新价（倒计时标签跟着它的纵坐标走） */
  price: number | null;
  text: string;
  color: string;
}

/**
 * 价格轴倒计时：在最新价标签下方显示当前大周期K线的剩余时间（回放时间，不是现实时间）
 */
export class CountdownPrimitive implements ISeriesPrimitive<Time> {
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: CountdownState = { price: null, text: '', color: '#64748b' };

  private readonly axisView: ISeriesPrimitiveAxisView = {
    coordinate: () => {
      const { price } = this.state;
      const y = price === null ? null : this.series?.priceToCoordinate(price);
      return y === null || y === undefined ? -100 : y + PRICE_LABEL_HEIGHT;
    },
    text: () => this.state.text,
    textColor: () => '#ffffff',
    backColor: () => this.state.color,
    visible: () => Boolean(this.state.text) && this.state.price !== null,
    tickVisible: () => false,
  };

  attached(param: SeriesAttachedParameter<Time>) {
    this.series = param.series as ISeriesApi<SeriesType>;
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.series = null;
    this.requestUpdate = null;
  }

  setState(next: CountdownState) {
    this.state = next;
    this.requestUpdate?.();
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return [this.axisView];
  }
}

/** 剩余分钟 → 「35m」「3h20m」 */
const fmtDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? `${m}m` : ''}` : `${m}m`;
};

/**
 * 当前大周期K线的剩余时间（按回放时间）：
 * 桶起点 = floor(游标 / 周期) × 周期，剩余 = 桶终点 − 游标这根 5m 的收盘
 */
export const countdownText = (cursorTime: number, intervalMs: number, baseMs: number): string => {
  if (intervalMs <= baseMs) return '';
  const bucket = Math.floor(cursorTime / intervalMs) * intervalMs;
  const remainingMs = Math.max(0, bucket + intervalMs - (cursorTime + baseMs));
  return remainingMs === 0 ? '收盘' : fmtDuration(Math.round(remainingMs / 60_000));
};
