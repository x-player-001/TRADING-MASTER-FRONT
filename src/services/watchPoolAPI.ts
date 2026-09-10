import { astockGet } from './astockApiClient';
import type { BoardGroup } from './astockAPI';

// ===== 低位首板池（watch_pool）=====
// ≤30% 低位 + 前60日无涨停的票拉出涨停后入池，此后 30 个交易日跟踪，
// 直到再次涨停（hit）或窗口走完（expired）。实测 30 日内再次涨停率 39.05%。
// 低位放量池是另一套表和接口，见 lowvolAPI.ts

export type WatchStatus = 'watching' | 'hit' | 'expired';
export type WatchEntryType = 'solo' | 'consecutive';
export type WatchOrderBy = 'live_score' | 'entry_score' | 'trigger_date';

// 入池评分分项（后端键名可能调整，故为开放字典，展示时按实际返回的键遍历）
export type WatchEntryScores = Record<string, number>;

// 入池后每个交易日的量价记录
export interface WatchTrackPoint {
  trade_date: string;
  days_since: number;        // 距首板第几个交易日
  close: number;
  pct_chg: number;           // 当日涨跌%
  ret_since: number;         // 相对首板收盘的涨跌%
  amount_ratio: number;      // 成交额/首板日成交额
  is_limit_up: boolean;
}

export interface WatchItem {
  id: number;
  code: string;
  name: string;
  board_group: BoardGroup;

  trigger_date: string;          // 首板日
  trigger_close: number;         // 首板日收盘价
  trigger_pct: number;           // 首板日涨幅%
  gain_from_low: number;         // 距120日低点涨幅%，越小越低位

  trigger_vol_ratio: number;     // 首板日放量倍数（最具预测力，越小越好）
  flat_days: number;             // 低位横盘天数（仅展示，无预测力）

  entry_score: number;           // 入池评分 0~1，入池后不再变
  entry_scores: WatchEntryScores;
  live_score: number;            // 跟踪评分 0~1，随行情更新

  consec_boards: number;         // 首板起连了几个板（1=孤板）
  entry_type: WatchEntryType;
  broke_open_date: string | null;  // 跌破首板开盘价的日期，null=未跌破
  broke_open_days: number | null;

  status: WatchStatus;
  hit_date: string | null;       // 再次涨停日
  hit_days: number | null;       // 距首板第几个交易日命中
  expire_date: string | null;    // 30日窗口末日，null=窗口未走满（正常）

  last_ret_since: number;        // 最新一天相对首板收盘的涨跌%
  last_amount_ratio: number;     // 最新一天成交额/首板日成交额
  days_in_pool: number;          // 已跟踪几个交易日
  track: WatchTrackPoint[];      // 列表接口恒为空，详情接口才有
}

export interface WatchListParams {
  status?: WatchStatus;
  entry_type?: WatchEntryType;
  board_group?: BoardGroup;
  exclude_broke?: boolean;   // true=剔除已跌破首板开盘价的票，默认 false
  since?: string;            // 只看首板日 >= 该日期
  order_by?: WatchOrderBy;
  limit?: number;            // 1~500，默认 100
}

export interface WatchStats {
  total: number;
  watching: number;
  hit: number;
  expired: number;
  hit_rate: number;              // ⚠️ hit/(hit+expired)，存在幸存者偏差，勿直接当策略胜率
  avg_hit_days: number;          // 平均多少个交易日后再次涨停
  by_entry_type: Partial<Record<WatchEntryType, number>>;  // 分组命中率%（更可信）
  benchmark_hint: string;
}

// ── 展示辅助 ──────────────────────────────────────────
// 首板放量倍数分档：实测 <2倍命中43.1% / 2-4倍40.2% / 4-6倍32.6% / ≥6倍仅18.8%
export type VolRatioLevel = 'good' | 'normal' | 'warn' | 'danger';

export const volRatioLevel = (ratio: number | null | undefined): VolRatioLevel => {
  if (ratio === null || ratio === undefined) return 'normal';
  if (ratio >= 6) return 'danger';
  if (ratio >= 4) return 'warn';
  if (ratio < 2) return 'good';
  return 'normal';
};

export const STATUS_LABELS: Record<WatchStatus, string> = {
  watching: '跟踪中',
  hit: '已命中',
  expired: '已到期',
};

export const ENTRY_TYPE_LABELS: Record<WatchEntryType, string> = {
  solo: '孤板',
  consecutive: '连板',
};

export const ENTRY_SCORE_LABELS: Record<string, string> = {
  trigger_volume: '首板放量',
  low_position: '低位程度',
  liquidity: '流动性',
  volume_x: '放量倍数',
};

class WatchPoolAPIService {
  // 监控池列表
  async getWatchList(params: WatchListParams = {}): Promise<WatchItem[]> {
    return astockGet<WatchItem[]>('/api/watch', { params });
  }

  // 命中率统计
  async getWatchStats(since?: string): Promise<WatchStats> {
    return astockGet<WatchStats>('/api/watch/stats', { params: since ? { since } : undefined });
  }

  // 个股详情（比列表多 track 数组）
  // 同一只票可能多次入池，默认返回最近一次，可用 trigger_date 指定
  async getWatchDetail(code: string, triggerDate?: string): Promise<WatchItem> {
    return astockGet<WatchItem>(`/api/watch/${code}`, {
      params: triggerDate ? { trigger_date: triggerDate } : undefined,
    });
  }
}

export const watchPoolAPI = new WatchPoolAPIService();
export default WatchPoolAPIService;
