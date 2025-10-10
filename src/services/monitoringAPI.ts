import {
  SystemHealthResponse,
  SystemMetrics,
  AlertsResponse,
  SystemStats,
  ServicesStatusResponse,
  LogFilesResponse,
  LogContent,
  MetricsHistoryResponse
} from '../types';
import { apiGet, apiPost, apiPatch } from './apiClient';

class MonitoringAPIService {

  // 获取系统健康状态
  async getSystemHealth(): Promise<SystemHealthResponse> {
    return apiGet<SystemHealthResponse>('/api/monitoring/health');
  }

  // 获取最新系统指标
  async getLatestMetrics(): Promise<SystemMetrics> {
    return apiGet<SystemMetrics>('/api/monitoring/metrics/latest');
  }

  // 获取历史指标数据 (注意：根据API文档，此功能待实现)
  async getMetricsHistory(params?: {
    limit?: number;
    hours?: number;
  }): Promise<MetricsHistoryResponse> {
    return apiGet<MetricsHistoryResponse>('/api/monitoring/metrics', { params });
  }

  // 获取活跃警报
  async getActiveAlerts(): Promise<AlertsResponse> {
    return apiGet<AlertsResponse>('/api/monitoring/alerts');
  }

  // 获取警报历史
  async getAlertsHistory(params?: {
    hours?: number;
    limit?: number;
  }): Promise<AlertsResponse> {
    return apiGet<AlertsResponse>('/api/monitoring/alerts/history', { params });
  }

  // 获取系统统计信息
  async getSystemStats(): Promise<SystemStats> {
    return apiGet<SystemStats>('/api/monitoring/stats');
  }

  // 获取统计摘要
  async getStatsSummary(): Promise<{
    system_status: string;
    monitoring_active: boolean;
    active_alerts: number;
    critical_alerts: number;
    uptime_hours: number;
    memory_usage: number;
    api_requests: number;
    last_update: string;
  }> {
    return apiGet('/api/monitoring/stats/summary');
  }

  // 获取监控服务状态
  async getMonitoringStatus(): Promise<{
    is_running: boolean;
    uptime: number;
    latest_collection: string;
    latest_health_check: string;
    active_alerts_count: number;
    config: {
      collection_interval: number;
      health_check_interval: number;
      metrics_retention_hours: number;
      alert_thresholds: Record<string, number>;
    };
  }> {
    return apiGet('/api/monitoring/status');
  }

  // 获取特定服务健康状态
  async getServiceHealth(serviceName: string): Promise<SystemHealthResponse> {
    return apiGet<SystemHealthResponse>(`/api/monitoring/health/${serviceName}`);
  }
}

// 创建单例实例
export const monitoringAPI = new MonitoringAPIService();

// 导出服务类
export default MonitoringAPIService;