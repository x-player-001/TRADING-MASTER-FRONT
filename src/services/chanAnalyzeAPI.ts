/**
 * 新版缠论引擎 /api/chan（文档：docs/CHAN_API.md）
 * 一次请求返回 K线 + 笔、线段、中枢、买卖点。与旧 chanAPI（/api/structure/chan-analysis）无关。
 */
import { apiGet } from './apiClient';

export type ChanInterval = '5m' | '15m' | '1h' | '4h';
export const CHAN_INTERVALS: ChanInterval[] = ['5m', '15m', '1h', '4h'];
export type ChanBiMode = 'strict' | 'loose';

export interface ChanKline {
  open_time: number;
  close_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed: boolean;
}

/** 笔 / 线段公共字段（时间均为毫秒，等于某根K线 open_time） */
export interface ChanStrokeItem {
  index: number;
  direction: 'up' | 'down';
  start_time: number;
  start_price: number;
  end_time: number;
  end_price: number;
  raw_start: number;
  raw_end: number;
  high: number;
  low: number;
  macd_area: number;
  is_confirmed: boolean;
}

export interface ChanSegment extends ChanStrokeItem {
  bi_start: number;
  bi_end: number;
  end_case?: 'no_gap' | 'gap';
}

export interface ChanCenter {
  index: number;
  level: 'bi' | 'seg';
  item_start: number;
  item_end: number;
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  start_time: number;
  end_time: number;
  entry_item: number | null;
  exit_item: number | null;
  leave_item: number | null;
  is_completed: boolean;
}

export interface ChanBsp {
  level: 'bi' | 'seg';
  type: '1' | '2' | '3';
  side: 'buy' | 'sell';
  item_index: number;
  price: number;
  time: number;
  raw_index: number;
  center_index: number | null;
  is_confirmed: boolean;
  /** 仅一类 */
  divergence_type?: 'trend' | 'consolidation';
  area_ratio?: number;
  /** 仅二类 */
  ref_item?: number;
}

export interface ChanAnalyzeResult {
  symbol: string;
  interval: ChanInterval;
  options: Record<string, unknown>;
  kline_count: number;
  merged_count: number;
  first_time: number;
  last_time: number;
  last_close: number;
  klines?: ChanKline[];
  bis: ChanStrokeItem[];
  segments: ChanSegment[];
  bi_centers: ChanCenter[];
  seg_centers: ChanCenter[];
  bsp: ChanBsp[];
}

export interface ChanAnalyzeParams {
  symbol: string;
  interval?: ChanInterval;
  /** 已收盘K线根数 50~3000 */
  limit?: number;
  /** 毫秒，查看历史某时刻的结构 */
  end_time?: number;
  bi_mode?: ChanBiMode;
  /** 仅 loose 生效 */
  min_bi_raw_bars?: number;
  divergence_ratio?: number;
  allow_consolidation_bsp1?: boolean;
}

export const chanAnalyzeAPI = {
  /** GET /api/chan/analyze，固定附带K线（结构与K线严格同一份数据） */
  analyze(params: ChanAnalyzeParams): Promise<ChanAnalyzeResult> {
    const { allow_consolidation_bsp1, bi_mode, min_bi_raw_bars, ...rest } = params;
    return apiGet<ChanAnalyzeResult>('/api/chan/analyze', {
      params: {
        ...rest,
        bi_mode,
        min_bi_raw_bars: bi_mode === 'loose' ? min_bi_raw_bars : undefined,
        allow_consolidation_bsp1: allow_consolidation_bsp1 === undefined ? undefined : allow_consolidation_bsp1 ? 1 : 0,
        include_klines: 1,
      },
      // 3000 根K线全量计算，默认 10s 不够
      timeout: 60000,
    });
  },
};

export default chanAnalyzeAPI;
