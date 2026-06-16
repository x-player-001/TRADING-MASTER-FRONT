import { apiGet, apiDelete } from './apiClient';

export interface Ema20PushContext {
  symbol: string;
  timeframe: string;
  push_count: number;
  amplitude_pct: number;
  ema20: number;
  current_price: number;
  last_push_time: number;
  created_at: string;
}

export interface Ema20PushRecord {
  id: number;
  symbol: string;
  timeframe: string;
  push_time: number;
  current_price: number;
  ema20: number;
  amplitude_pct: number;
  created_at: string;
}

class Ema20PushAPIService {
  private baseUrl = '/api/ema20-push';

  async getContexts(params?: {
    timeframe?: string;
    min_push_count?: number;
    limit?: number;
  }): Promise<Ema20PushContext[]> {
    return apiGet<Ema20PushContext[]>(`${this.baseUrl}/contexts`, { params });
  }

  async getRecords(symbol: string, timeframe: string): Promise<Ema20PushRecord[]> {
    return apiGet<Ema20PushRecord[]>(
      `${this.baseUrl}/contexts/${encodeURIComponent(symbol)}/${timeframe}/records`
    );
  }

  async deleteContext(symbol: string, timeframe: string): Promise<void> {
    return apiDelete(
      `${this.baseUrl}/contexts/${encodeURIComponent(symbol)}/${timeframe}`
    );
  }
}

export const ema20PushAPI = new Ema20PushAPIService();
export default Ema20PushAPIService;
