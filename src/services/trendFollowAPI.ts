import { apiGet, apiDelete, apiPatch } from './apiClient';

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

  async deleteWatchContext(id: number): Promise<void> {
    return apiDelete(`${this.baseUrl}/watch-contexts/${id}`);
  }

  async updateRemark(id: number, remark: string | null): Promise<void> {
    return apiPatch(`${this.baseUrl}/watch-contexts/${id}/remark`, { remark });
  }
}

export const trendFollowAPI = new TrendFollowAPIService();
export default TrendFollowAPIService;
