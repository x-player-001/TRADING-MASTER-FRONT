import { apiGet } from './apiClient';

// ===== 日线压力线突破 /api/daily-breakout =====
// 时间全是毫秒（UTC 日线）；百分比字段已是百分数（1.19 = 1.19%）。

export type DailyBreakoutStatus = 'breakout' | 'retest' | 'failed';
export type DailyBreakoutLineType = 'descending' | 'horizontal';
export type DailyBreakoutSort = 'breakout_time' | 'distance' | 'volume_ratio' | 'touches';

export const DAILY_BREAKOUT_STATUS_LABELS: Record<DailyBreakoutStatus, string> = {
  breakout: '已突破',
  retest: '回踩中',
  failed: '失败',
};

export const DAILY_BREAKOUT_LINE_TYPE_LABELS: Record<DailyBreakoutLineType, string> = {
  descending: '下降线',
  horizontal: '盘整上沿',
};

export interface DailyBreakoutPoint {
  time: number;
  value: number;
}

export interface DailyBreakoutSignal {
  id: number;
  symbol: string;
  line_type: DailyBreakoutLineType;
  price_scale: string;
  touch_count: number;
  touches: { time: number; price: number }[];
  line_start_time: number;
  line_start_price: number;
  line_start_value: number;
  line_end_time: number;
  line_end_price: number;
  slope_pct_per_day: number;
  span_days: number;
  depth_pct: number;
  fit_error_pct: number;
  breakout_time: number;
  breakout_close: number;
  breakout_line_value: number;
  breakout_pct: number;          // 突破日收盘高出线 %
  breakout_volume_ratio: number;
  status: DailyBreakoutStatus;
  retest_time: number | null;
  retest_low: number | null;
  retest_distance_pct: number | null;
  fail_time: number | null;
  max_gain_pct: number;          // 突破后最大涨幅 %
  last_time: number;
  last_close: number;
  last_line_value: number;
  last_distance_pct: number;     // 最新收盘离线 %
  created_at: string;
  updated_at: string;
  /** 压力线的点，从首触点到最新一天，直接连线即可 */
  line: DailyBreakoutPoint[];
}

export interface DailyBreakoutKline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DailyBreakoutDetail extends DailyBreakoutSignal {
  /** 首触点前 30 天到今天的日线 */
  klines: DailyBreakoutKline[];
}

export interface DailyBreakoutQuery {
  status?: DailyBreakoutStatus[];
  days?: number;
  line_type?: DailyBreakoutLineType;
  symbol?: string;
  min_volume_ratio?: number;
  min_breakout_pct?: number;
  min_touches?: number;
  min_span_days?: number;
  max_distance_pct?: number;
  sort?: DailyBreakoutSort;
  limit?: number;
}

class DailyBreakoutAPIService {
  private baseUrl = '/api/daily-breakout';

  /** 突破事件列表（apiClient 已解包，直接是数组） */
  async getSignals(q: DailyBreakoutQuery = {}): Promise<DailyBreakoutSignal[]> {
    const params: Record<string, unknown> = { ...q };
    if (q.status?.length) params.status = q.status.join(',');
    else delete params.status;
    return apiGet<DailyBreakoutSignal[]>(`${this.baseUrl}/signals`, { params });
  }

  /** 单条事件 + 画图用日线 */
  async getSignal(id: number): Promise<DailyBreakoutDetail> {
    return apiGet<DailyBreakoutDetail>(`${this.baseUrl}/signals/${id}`);
  }
}

export const dailyBreakoutAPI = new DailyBreakoutAPIService();
