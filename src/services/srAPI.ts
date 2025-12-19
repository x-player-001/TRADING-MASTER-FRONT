import { SRAlertsResponse, SRLevelsResponse } from '../types';
import { apiGet } from './apiClient';

class SRAPIService {
  // 获取最近报警信号
  async getRecentAlerts(params?: {
    limit?: number;
    alert_type?: 'APPROACHING' | 'TOUCHED';
    level_type?: 'SUPPORT' | 'RESISTANCE';
  }): Promise<SRAlertsResponse> {
    return apiGet<SRAlertsResponse>('/api/sr/alerts/recent', { params });
  }

  // 获取指定币种报警
  async getAlertsBySymbol(symbol: string, params?: {
    limit?: number;
  }): Promise<SRAlertsResponse> {
    return apiGet<SRAlertsResponse>(`/api/sr/alerts/${symbol}`, { params });
  }

  // 获取指定币种和周期报警
  async getAlertsBySymbolInterval(symbol: string, interval: string, params?: {
    limit?: number;
  }): Promise<SRAlertsResponse> {
    return apiGet<SRAlertsResponse>(`/api/sr/alerts/${symbol}/${interval}`, { params });
  }

  // 获取活跃支撑阻力位
  async getLevels(symbol: string, interval: string): Promise<SRLevelsResponse> {
    return apiGet<SRLevelsResponse>(`/api/sr/levels/${symbol}/${interval}`);
  }

  // 获取价格范围内的支撑阻力位
  async getLevelsInRange(symbol: string, interval: string, params: {
    min_price: number;
    max_price: number;
  }): Promise<SRLevelsResponse> {
    return apiGet<SRLevelsResponse>(`/api/sr/levels/${symbol}/${interval}/range`, { params });
  }

  // 实时计算支撑阻力位（不存储）
  async detectLevels(symbol: string, interval: string, params?: {
    kline_count?: number;
  }): Promise<SRLevelsResponse> {
    return apiGet<SRLevelsResponse>(`/api/sr/detect/${symbol}/${interval}`, { params });
  }
}

export const srAPI = new SRAPIService();
export default srAPI;
