import { apiGet, apiDelete, apiPatch } from './apiClient';

export interface RawKline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type WatchContextState = 'WATCHING' | 'ALERTED' | 'ABANDONED' | 'DELETED' | 'BREAKTHROUGH';

export interface WatchContext {
  id: number;
  symbol: string;
  timeframe: string;
  state: WatchContextState;

  wave_start_price: number;
  wave_end_price: number;
  wave_amplitude_pct: number;
  wave_bar_count: number;
  wave_avg_volume: number;
  wave_end_time: number;

  pullback_lowest_price: number;
  pullback_bar_count: number;
  pullback_avg_volume: number;

  current_price: number;
  quote_volume_24h: number;

  last_alert_level: number;
  watch_start_time: number;
  abandoned_reason: string | null;
  remark: string | null;
  updated_at: string;
}

export interface TrendAlert {
  id: number;
  symbol: string;
  timeframe: string;
  alert_level: 1 | 2 | 3;
  kline_time: number;
  current_price: number;

  wave_start_price: number;
  wave_end_price: number;
  wave_amplitude_pct: number;
  wave_bar_count: number;

  pullback_ratio: number;
  fib_zone: string;
  volume_shrink: boolean;
  reversal_signal: boolean;
  created_at: string;
}

export interface CleanupResult {
  deleted: number;
}

export type StopMode = 'low' | 'wave';

// 报警事后统计 / 扳机统计共用的行结构
export interface OutcomeStatRow {
  alert_level: number;
  timeframe: string;
  samples: number;
  wins: number;
  losses: number;
  opens: number;
  win_rate: number | null;      // 仅按 win/loss 算，全是 open 时为 null
  avg_rr: number | null;
  avg_mfe_pct: number | null;
  avg_mae_pct: number | null;
  // by_signals=true 时按信号组合细分
  volume_shrink?: boolean;
  reversal_signal?: boolean;
  ema20_support?: boolean;
}

// 扳机统计：分组键是 parent_timeframe × parent_alert_level
export interface TriggerStatRow extends Omit<OutcomeStatRow, 'alert_level' | 'timeframe'> {
  parent_timeframe: string;
  parent_alert_level: number;
  unevaluated: number;          // 尚未评估的条数
}

export type TriggerOutcome = 'win' | 'loss' | 'open' | 'unevaluated';

// 报警的事后成绩单（未评估时整个 outcome 为 null）
export interface AlertOutcome {
  entry_price: number;
  target_price: number;
  mfe_pct: number | null;
  mae_pct: number | null;
  outcome_low: 'win' | 'loss' | 'open' | null;
  rr_low: number | null;
  bars_to_exit_low: number | null;
  outcome_wave: 'win' | 'loss' | 'open' | null;
  rr_wave: number | null;
  bars_to_exit_wave: number | null;
  evaluated_at: string | null;
}

// 报警 + 成绩单（逐条对照）
export interface AlertWithOutcome extends TrendAlert {
  ema20_support?: boolean;
  outcome: AlertOutcome | null;
}

// 扳机事件
export interface TriggerEvent {
  id: number;
  symbol: string;
  parent_timeframe: string;
  parent_alert_level: number;
  kline_time: number;            // 5m 确认K线时间
  confirm_price: number;         // 建议入场
  trigger_stop: number;          // 建议止损
  target_price: number;          // 目标
  rr_ratio: number | null;
  outcome: TriggerOutcome | null; // null = 尚未评估
  eval_bars?: number;
  mfe_pct?: number | null;
  mae_pct?: number | null;
  bars_to_exit?: number | null;
  evaluated_at?: string | null;
  created_at: string;
}

class TrendFollowAPIService {
  private baseUrl = '/api/trend-follow';

  async getWatchContexts(params?: {
    symbol?: string;
    timeframe?: string;
    state?: WatchContextState;
    deleted?: boolean;
    limit?: number;
  }): Promise<WatchContext[]> {
    const { state, ...rest } = params ?? {};
    const query: Record<string, unknown> = { ...rest };
    if (state === 'DELETED') {
      query.deleted = true;
    } else if (state) {
      query.state = state;
    }
    return apiGet<WatchContext[]>(`${this.baseUrl}/watch-contexts`, { params: query });
  }

  async getAlerts(params?: {
    symbol?: string;
    timeframe?: string;
    alert_level?: number;
    date?: string;
    start_time?: number;
    end_time?: number;
    limit?: number;
  }): Promise<TrendAlert[]> {
    return apiGet<TrendAlert[]>(`${this.baseUrl}/alerts`, { params });
  }

  async getRecentAlerts(params?: {
    limit?: number;
    timeframe?: string;
    alert_level?: number;
  }): Promise<TrendAlert[]> {
    return apiGet<TrendAlert[]>(`${this.baseUrl}/alerts/recent`, { params });
  }

  async cleanupAlerts(days?: number): Promise<CleanupResult> {
    return apiDelete<CleanupResult>(`${this.baseUrl}/alerts/cleanup`, { params: { days } });
  }

  async getLatestKlines(symbol: string, interval: string, limit = 150): Promise<RawKline[]> {
    return apiGet<RawKline[]>(`${this.baseUrl}/klines/${symbol}/${interval}`, { params: { limit } });
  }

  async deleteWatchContext(id: number): Promise<void> {
    return apiDelete(`${this.baseUrl}/watch-contexts/${id}`);
  }

  async updateRemark(id: number, remark: string | null): Promise<void> {
    return apiPatch(`${this.baseUrl}/watch-contexts/${id}/remark`, { remark });
  }

  // 报警事后统计
  async getOutcomeStats(params?: {
    stop?: StopMode;
    timeframe?: string;
    alert_level?: number;
    by_signals?: boolean;
  }): Promise<OutcomeStatRow[]> {
    return apiGet<OutcomeStatRow[]>(`${this.baseUrl}/outcome-stats`, { params });
  }

  // 扳机(5m确认入场)统计
  async getTriggerStats(): Promise<TriggerStatRow[]> {
    return apiGet<TriggerStatRow[]>(`${this.baseUrl}/trigger-stats`);
  }

  // 报警 + 事后成绩单（逐条对照）
  async getAlertsWithOutcome(params?: {
    symbol?: string;
    timeframe?: string;
    date?: string;
    only_evaluated?: boolean;
    limit?: number;
  }): Promise<AlertWithOutcome[]> {
    return apiGet<AlertWithOutcome[]>(`${this.baseUrl}/alerts/with-outcome`, { params });
  }

  // 扳机事件列表（按确认时间倒序）
  async getTriggers(params?: {
    symbol?: string;
    parent_timeframe?: string;
    outcome?: TriggerOutcome;
    start_time?: number;
    limit?: number;
  }): Promise<TriggerEvent[]> {
    return apiGet<TriggerEvent[]>(`${this.baseUrl}/triggers`, { params });
  }
}

export const trendFollowAPI = new TrendFollowAPIService();
export default TrendFollowAPIService;
