import { OIStatisticsResponse, OIAnomaliesResponse, OIStatusResponse } from '../types';
import { apiGet, apiPost, apiPut } from './apiClient';

class OIAPIService {

  // 获取OI统计数据
  async getOIStatistics(params?: {
    symbol?: string;
    date?: string;
    limit?: number;
  }): Promise<OIStatisticsResponse> {
    return apiGet<OIStatisticsResponse>('/api/oi/statistics', { params });
  }

  // 获取最近异常数据
  async getRecentAnomalies(params?: {
    symbol?: string;
    date?: string;
    severity?: 'low' | 'medium' | 'high';
    hours?: number;
    limit?: number;
  }): Promise<OIAnomaliesResponse> {
    return apiGet<OIAnomaliesResponse>('/api/oi/recent-anomalies', { params });
  }

  // 获取系统状态
  async getOIStatus(): Promise<OIStatusResponse> {
    return apiGet<OIStatusResponse>('/api/status');
  }

  // 健康检查
  async healthCheck(): Promise<{ status: string; timestamp: string; service: string }> {
    return apiGet('/health');
  }

  // 获取API根信息
  async getAPIInfo(): Promise<{
    message: string;
    version: string;
    endpoints: Record<string, string>;
    timestamp: string;
  }> {
    return apiGet('/api');
  }

  // 获取OI服务状态
  async getOIServiceStatus() {
    return apiGet('/api/oi/status');
  }

  // 获取启用的币种列表
  async getEnabledSymbols() {
    return apiGet('/api/oi/symbols');
  }

  // 获取OI监控配置
  async getOIConfig() {
    return apiGet('/api/oi/config');
  }

  // 更新OI监控配置
  async updateOIConfig(key: string, value: any) {
    return apiPut(`/api/oi/config/${key}`, { value });
  }


  // 获取OI快照数据
  async getOISnapshots(params?: {
    symbol?: string;
    start_time?: string;
    end_time?: string;
    limit?: number;
    order?: 'ASC' | 'DESC';
  }) {
    return apiGet('/api/oi/snapshots', { params });
  }

  // 获取异常数据（可配置查询参数）
  async getAnomalies(params?: {
    symbol?: string;
    period_seconds?: number;
    severity?: 'low' | 'medium' | 'high';
    start_time?: string;
    end_time?: string;
    limit?: number;
    order?: 'ASC' | 'DESC';
  }) {
    return apiGet('/api/oi/anomalies', { params });
  }
}

// 创建单例实例
export const oiAPI = new OIAPIService();

// 导出服务类
export default OIAPIService;