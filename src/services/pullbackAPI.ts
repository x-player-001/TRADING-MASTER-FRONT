import { astockGet } from './astockApiClient';
import type { BoardGroup } from './astockAPI';

// ===== 回踩池（pullback）=====
// 盯「突破后回踩」：先有一段放量突破或连续上涨（entry_kind 区分两种入池方式），
// 随后回落到均线附近，观察其能否重新走强。
//
// ⚠️ 后端明确标注：本形态**尚未回测验证**，命中率无历史基准可比。
//    stats.hit_rate 只是池内统计，不能当作策略胜率对外展示。

// 状态机已拆细（旧的 watching / expired 被废弃）：
//   armed     待回踩，尚未报警
//   triggered 已报警
//   missed    第二波来了但没接住
//   failed    报警后失败
//   expired   从未回踩，作废
//   hit       报警后命中
//   settled   报警后窗口内没再涨停
//   legacy    旧口径遗留数据
// 后端对 watching→triggered、expired→settled 做了别名映射，旧写法仍返回 200，
// 但语义已不准，前端一律使用新名。
export type PullbackStatus =
  | 'armed' | 'triggered' | 'missed' | 'failed'
  | 'expired' | 'hit' | 'settled' | 'legacy';

// limitup = 涨停突破入池，streak = 连续上涨入池
export type PullbackEntryKind = 'limitup' | 'streak';

// 节奏分型：回答「若涨停、预计多快」，不是「会不会涨停」。
// 实测 n=13702：急 快速涨停11.90%/总命中26.58%，中 3.58%/12.49%，缓 1.54%/8.19%。
// ⚠️ 两个使用边界（文档明确要求）：
//   1. 不要拿它筛票——缓组样本是急组的 8 倍，按节奏过滤会砍掉大部分命中
//   2.「缓」不是"预计慢慢涨"，是"不具备急涨特征"，是排除法的结果，
//      缓组总命中率仅 8.19%，里面大部分根本不涨
// 故前端只做展示与分组查看，不提供 rhythm 筛选器。
export type PullbackRhythm = '急' | '中' | '缓';


export const PULLBACK_STATUS_LABELS: Record<PullbackStatus, string> = {
  armed: '待回踩',
  triggered: '已报警',
  missed: '未接住',
  failed: '已失败',
  expired: '未回踩',
  hit: '已命中',
  settled: '已结算',
  legacy: '旧数据',
};

// 状态说明，用于 tooltip
export const PULLBACK_STATUS_HINTS: Record<PullbackStatus, string> = {
  armed: '已登记回踩，等待第二波启动，尚未报警',
  triggered: '已报警——第二波启动信号已发出',
  missed: '第二波来了但没接住',
  failed: '报警后走失败',
  expired: '从未回踩，该记录作废',
  hit: '报警后命中（窗口内再次涨停）',
  settled: '报警后窗口内未再涨停，已结算',
  legacy: '旧口径遗留数据',
};

export const ENTRY_KIND_LABELS: Record<PullbackEntryKind, string> = {
  limitup: '涨停突破',
  streak: '连涨突破',
};

// 入池后每个交易日的跟踪记录
export interface PullbackTrackPoint {
  trade_date: string;
  days_since: number;
  close: number;
  pct_chg: number;
  ret_since: number;      // 相对回踩日收盘的涨跌%
  amount_ratio: number;
  dist_ma10: number;      // 距 MA10 的偏离%
  is_limit_up: boolean;
}

export interface PullbackItem {
  id: number;
  code: string;
  name: string;
  board_group: BoardGroup;

  // ── 突破段 ──
  breakout_date: string;
  breakout_close: number;
  breakout_open: number;
  breakout_pct: number;
  breakout_amount: number;
  gain_from_low: number;        // 距低点涨幅%
  breakout_vol_ratio: number;   // 突破日放量倍数
  flat_days: number;
  breakout_boards: number;      // 突破段连板数

  entry_kind: PullbackEntryKind;
  streak_days: number;          // 连涨天数
  streak_gain: number;          // 连涨累计涨幅%
  streak_end_date: string | null;
  first_board: boolean;

  // ── 回踩段 ──
  pullback_date: string;
  pullback_close: number;
  drawdown: number;             // 回撤%
  peak_close: number;
  drawdown_from_peak: number;   // 距高点回撤%
  dist_ma5: number;             // 距 MA5 偏离%
  dist_ma10: number;
  dist_ma20: number;
  pullback_days: number;
  pullback_vol_ratio: number;   // 回踩日缩量倍数
  vol20: number | null;         // 相对20日均量
  rhythm: PullbackRhythm | null;// 节奏分型，仅展示不筛选

  // ── 热度（新增）──
  // 命中当日热门概念/题材时才有值；实测 hot_themes 与 theme_consec_days
  // 绝大多数为空（493/500），仅 hot_concepts 较常填充
  hot_concepts: string[];
  hot_themes: string[];
  top_concept_pct: number | null;    // 龙头概念当日涨幅%
  top_concept_share: number | null;  // 该票在概念内的权重占比
  theme_consec_days: number | null;  // 题材连续上榜天数
  hot_score: number | null;          // 热度综合评分

  // ── 结算 ──
  status: PullbackStatus;
  armed_date: string | null;         // 登记为待回踩的日期
  peak_broken_date: string | null;   // 跌破前高的日期
  hit_date: string | null;
  hit_days: number | null;
  expire_date: string | null;
  broke_date: string | null;    // 跌破关键位的日期
  broke_days: number | null;

  ret1: number | null;
  ret3: number | null;
  ret5: number | null;
  ret10: number | null;
  max_ret: number | null;       // 跟踪期内最大收益%
  last_ret_since: number | null;
  last_dist_ma10: number | null;
  days_in_pool: number | null;

  track: PullbackTrackPoint[];  // 列表接口恒为空，详情接口才有
}

export interface PullbackListParams {
  status?: PullbackStatus;
  board_group?: BoardGroup;
  entry_kind?: PullbackEntryKind;
  min_streak_gain?: number;
  max_gain_from_low?: number;
  exclude_broke?: boolean;
  only_hot?: boolean;        // 只看命中热门概念/题材的（hot_score 非空）
  // ⚠️ only_fav 目前只有 /api/pullback 支持；实测 /api/watch 与 /api/lowvol
  // 传了会被静默忽略（200→200 且非法值不报 422），故未在那两个池子接入
  only_fav?: boolean;        // 只看已收藏的
  since?: string;
  limit?: number;
}

export interface PullbackStats {
  total: number;
  watching: number;
  hit: number;
  expired: number;
  hit_rate: number;          // ⚠️ 无历史基准可比，见 note
  avg_hit_days: number;
  avg_ret5: number | null;
  avg_ret10: number | null;
  avg_max_ret: number | null;
  by_boards?: Partial<Record<'solo' | 'consecutive', number>>;
  by_entry_kind?: Partial<Record<PullbackEntryKind, number>>;
  note?: string;             // 后端给的口径提醒，应原样展示
}

// 距均线偏离的着色：贴近均线（|x| 小）是回踩到位，偏离大则尚未回踩充分
export const distLevel = (v: number | null | undefined): 'near' | 'mid' | 'far' => {
  if (v === null || v === undefined) return 'far';
  const a = Math.abs(v);
  if (a <= 2) return 'near';
  if (a <= 5) return 'mid';
  return 'far';
};

class PullbackAPIService {
  async getList(params: PullbackListParams = {}): Promise<PullbackItem[]> {
    return astockGet<PullbackItem[]>('/api/pullback', { params });
  }

  // 裸路径经外网代理可能 503，统一带上 since 兜底（等价全量）
  async getStats(since?: string): Promise<PullbackStats> {
    return astockGet<PullbackStats>('/api/pullback/stats', {
      params: { since: since ?? '2000-01-01' },
    });
  }

  async getDetail(code: string): Promise<PullbackItem> {
    return astockGet<PullbackItem>(`/api/pullback/${code}`);
  }
}

export const pullbackAPI = new PullbackAPIService();
export default PullbackAPIService;
