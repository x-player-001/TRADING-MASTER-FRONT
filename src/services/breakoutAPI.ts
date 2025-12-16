import { BreakoutSignalsResponse, BreakoutStatisticsResponse } from '../types';
import { apiGet } from './apiClient';

class BreakoutAPIService {
  // 获取最近的突破信号
  async getRecentSignals(params?: {
    limit?: number;
  }): Promise<BreakoutSignalsResponse> {
    return apiGet<BreakoutSignalsResponse>('/api/breakout/recent', { params });
  }

  // 获取指定币种的突破信号
  async getSignalsBySymbol(symbol: string, params?: {
    limit?: number;
  }): Promise<BreakoutSignalsResponse> {
    return apiGet<BreakoutSignalsResponse>(`/api/breakout/symbol/${symbol}`, { params });
  }

  // 按方向获取突破信号
  async getSignalsByDirection(direction: 'UP' | 'DOWN', params?: {
    limit?: number;
  }): Promise<BreakoutSignalsResponse> {
    return apiGet<BreakoutSignalsResponse>(`/api/breakout/direction/${direction}`, { params });
  }

  // 按时间范围获取突破信号
  async getSignalsByRange(params: {
    start: string;
    end: string;
    limit?: number;
  }): Promise<BreakoutSignalsResponse> {
    return apiGet<BreakoutSignalsResponse>('/api/breakout/range', { params });
  }

  // 获取统计信息
  async getStatistics(params?: {
    hours?: number;
  }): Promise<BreakoutStatisticsResponse> {
    return apiGet<BreakoutStatisticsResponse>('/api/breakout/statistics', { params });
  }
}

export const breakoutAPI = new BreakoutAPIService();
export default breakoutAPI;
