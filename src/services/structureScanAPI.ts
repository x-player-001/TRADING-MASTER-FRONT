import { astockGet } from './astockApiClient';

// ===== A股结构识别：强势上涨+健康回调 / 长期平台突破 =====
// 两个接口都只作形态展示，不是买点信号。
// 价格字段是原始价（与 K 线 adjust=none 一致）；涨幅、回撤等比例按复权口径算过（除权安全），已是百分比数值。
// 传 code 返回该票逐日记录（按日期倒序）。

// ── 强势上涨 + 健康回调 GET /api/trend-pullback ──────────
export type TrendPullbackState = 'pullback' | 'breakout';

export const TREND_PULLBACK_STATE_LABELS: Record<TrendPullbackState, string> = {
  pullback: '回调中',
  breakout: '已突破',
};

export interface TrendPullbackItem {
  trade_date: string;
  code: string;
  name: string;
  state: TrendPullbackState;
  is_fine: boolean;          // 是否精选口径
  close: number;
  leg_low_date: string;      // 上涨段起点
  leg_low: number;
  peak_date: string;         // 上涨段高点
  peak: number;
  leg_gain: number;          // 上涨段涨幅 %
  leg_days: number;
  leg_limitups: number;      // 上涨段涨停数
  leg_above_ma10: number;    // 上涨段站上 MA10 的天数占比（0~1）
  leg_overlap: number;       // 上涨段K线重叠度（0~1，越小越流畅）
  pb_start: string;          // 回调开始日
  pb_days: number;
  max_dd: number;            // 回调最大回撤 %（负数）
  retrace: number;           // 回撤占涨幅比例 %
  amt_ratio: number;         // 回调期成交额 / 上涨段成交额
  pb_below_ma20: number;     // 回调期跌破 MA20 的天数
  ref: number;               // 箱体上沿（画线用）
  dist_to_ref: number;       // 收盘距箱体上沿 %
  fake_breaks: string[];     // 假突破日期（画标记用）
  breakout_date: string | null;
}

export interface TrendPullbackResponse {
  trade_date: string;
  fine_only: boolean;
  total: number;
  counts: Partial<Record<TrendPullbackState, number>>;
  items: TrendPullbackItem[];
  note: string;
}

// ── 长期平台突破 GET /api/box-breakout ───────────────────
export type BoxBreakoutStage = 'tl_break' | 'tl_retest' | 'box_break' | 'box_retest';

export const BOX_BREAKOUT_STAGE_LABELS: Record<BoxBreakoutStage, string> = {
  tl_break: '突破趋势线',
  tl_retest: '回踩趋势线',
  box_break: '突破平台顶',
  box_retest: '回踩平台顶',
};

export interface BoxBreakoutItem {
  trade_date: string;
  code: string;
  name: string;
  stage: BoxBreakoutStage;
  event: BoxBreakoutStage | '';  // 非空 = 当前阶段当日发生
  stage_date: string;
  stage_age: number;             // 距当前阶段发生的交易日数
  close: number;
  top_date: string;              // 平台顶（趋势线第一点）
  top: number;
  dist_to_top: number;           // 收盘距平台顶 %
  touch_date: string;            // 趋势线第二个触点
  slope_pct: number;             // 趋势线每日斜率 %
  box_days: number;
  box_depth: number;             // 平台深度 %（负数）
  prior_gain: number;            // 平台前段涨幅 %
  tl_line: number;               // 当日趋势线价位
  tl_break: string | null;
  tl_retest: string | null;
  box_break: string | null;
  box_retest: string | null;
}

export interface BoxBreakoutResponse {
  trade_date: string;
  total: number;
  counts: Partial<Record<BoxBreakoutStage, number>>;
  items: BoxBreakoutItem[];
  note: string;
}

class StructureScanAPIService {
  async getTrendPullback(params: {
    trade_date?: string;
    fine?: boolean;
    state?: TrendPullbackState;
    code?: string;
    limit?: number;
  } = {}): Promise<TrendPullbackResponse> {
    // astockApiClient 直接返回响应体（无 data 包装）
    return astockGet('/api/trend-pullback', { params });
  }

  async getBoxBreakout(params: {
    trade_date?: string;
    stage?: BoxBreakoutStage;
    event_only?: boolean;
    max_age?: number;
    min_prior_gain?: number;
    max_depth?: number;
    code?: string;
    limit?: number;
  } = {}): Promise<BoxBreakoutResponse> {
    return astockGet('/api/box-breakout', { params });
  }
}

export const structureScanAPI = new StructureScanAPIService();
