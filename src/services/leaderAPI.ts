/**
 * 龙头榜 /api/leaders（文档：docs/LEADER_BOARD_API.md）
 * 榜单与进榜事件由服务器 pm2 `leaders` 进程每根 15m 收盘后计算，这里只读。
 * 比例字段都是小数（-0.15 = -15%），时间为毫秒 UTC。
 */
import { apiGet } from './apiClient';

export type LeaderWindow = '24h' | '4h';
export type LeaderPhase = 'first_wave' | 'relisted' | 'pullback' | 'second_wave' | 'expired';
export type LeaderTier = 'high' | 'mid' | 'low';

export const LEADER_PHASE_LABELS: Record<LeaderPhase, string> = {
  first_wave: '第一波在榜',
  relisted: '再次上榜',
  pullback: '回撤观察',
  second_wave: '已二次新高',
  expired: '已过期',
};

/** 共振时附带的趋势跟随观察列表摘要 */
export interface LeaderWatchlistBrief {
  timeframes: string[];
  stage: string;
  retrace_now: number | null;
  score: number;
  score_tags: string[];
}

export interface LeaderEvaluation {
  phase: LeaderPhase;
  drawdown_from_peak: number | null;
  hours_since_peak: number | null;
  days_since_dropout: number | null;
  volume_decay: number | null;
  oi_wave: number | null;
  oi_pull: number | null;
  funding_rate: number | null;
  tags: string[];
  risk_tags: string[];
  /** 只在 pullback 阶段给出 */
  tier: LeaderTier | null;
  score: number | null;
}

export interface LeaderEpisode {
  id: number;
  symbol: string;
  window: LeaderWindow;
  status: 'listed' | 'watching' | 'expired';
  phase: LeaderPhase;
  phase_label: string;
  first_entry_time: number;
  streak_start_time: number;
  last_listed_time: number;
  listed_hours: number;
  entry_price: number;
  entry_change_24h: number;
  entry_rvol: number;
  change_since_entry: number | null;
  listed_bars: number;
  relist_count: number;
  last_rank: number | null;
  last_rvol: number | null;
  rvol_max: number;
  rolling_qv_max: number;
  peak_price: number;
  peak_time: number;
  dropout_time: number | null;
  pullback_low: number | null;
  max_high_after: number | null;
  second_wave_time: number | null;
  last_price: number;
  last_time: number;
  last_rolling_qv: number;
  baseline_qv: number;
  pre_trend30: number | null;
  prior_episodes_60d: number;
  market: {
    oi_start: number | null;
    oi_peak: number | null;
    oi_now: number | null;
    funding_rate: number | null;
    updated_at: number;
  } | null;
  resonance_notified_at: number | null;
  evaluation: LeaderEvaluation;
  watchlist: LeaderWatchlistBrief | null;
  resonance: boolean;
}

export interface LeaderBoardItem {
  rank: number;
  symbol: string;
  rvol: number;
  rolling_qv: number;
  close: number;
  change_24h: number;
  episode: LeaderEpisode | null;
  watchlist: LeaderWatchlistBrief | null;
  resonance: boolean;
}

export interface LeaderBoard {
  window: LeaderWindow;
  /** 榜单对应的 15m 收盘时刻 */
  bar_time: number;
  items: LeaderBoardItem[];
}

export interface GetEpisodesParams {
  window?: LeaderWindow | 'all';
  phase?: LeaderPhase[];
  resonance_only?: boolean;
  /** 含 expired 时回看天数 */
  days?: number;
}

const BASE = '/api/leaders';

export const leaderAPI = {
  getBoard(window: LeaderWindow = '24h'): Promise<LeaderBoard> {
    return apiGet(`${BASE}/board`, { params: { window } });
  },

  /** 默认返回未过期的全部阶段（第二波观察区），已按 共振 → 阶段 → 档位 → 最近在榜 排好序 */
  getEpisodes(params: GetEpisodesParams = {}): Promise<LeaderEpisode[]> {
    const { phase, resonance_only, ...rest } = params;
    return apiGet(`${BASE}/episodes`, {
      params: {
        ...rest,
        phase: phase?.length ? phase.join(',') : undefined,
        resonance_only: resonance_only ? 'true' : undefined,
      },
    });
  },

  getSymbolHistory(symbol: string): Promise<LeaderEpisode[]> {
    return apiGet(`${BASE}/symbol/${encodeURIComponent(symbol)}`);
  },
};

export default leaderAPI;
