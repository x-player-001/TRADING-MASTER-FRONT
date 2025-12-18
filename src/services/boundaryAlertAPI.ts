import { BoundaryAlertsResponse, BoundaryAlertStatistics } from '../types';
import { apiGet } from './apiClient';

class BoundaryAlertAPIService {
  // 获取最近的边界报警
  async getRecentAlerts(params?: {
    limit?: number;
  }): Promise<BoundaryAlertsResponse> {
    return apiGet<BoundaryAlertsResponse>('/api/boundary-alerts/recent', { params });
  }

  // 获取指定币种的边界报警
  async getAlertsBySymbol(symbol: string, params?: {
    limit?: number;
  }): Promise<BoundaryAlertsResponse> {
    return apiGet<BoundaryAlertsResponse>(`/api/boundary-alerts/symbol/${symbol}`, { params });
  }

  // 按类型获取边界报警
  async getAlertsByType(type: 'TOUCH_UPPER' | 'TOUCH_LOWER', params?: {
    limit?: number;
  }): Promise<BoundaryAlertsResponse> {
    return apiGet<BoundaryAlertsResponse>(`/api/boundary-alerts/type/${type}`, { params });
  }

  // 按时间范围获取边界报警
  async getAlertsByRange(params: {
    start: string;
    end: string;
    symbol?: string;
    limit?: number;
  }): Promise<BoundaryAlertsResponse> {
    return apiGet<BoundaryAlertsResponse>('/api/boundary-alerts/range', { params });
  }

  // 获取统计信息
  async getStatistics(params?: {
    period?: string;
  }): Promise<BoundaryAlertStatistics> {
    return apiGet<BoundaryAlertStatistics>('/api/boundary-alerts/statistics', { params });
  }
}

export const boundaryAlertAPI = new BoundaryAlertAPIService();
export default boundaryAlertAPI;
