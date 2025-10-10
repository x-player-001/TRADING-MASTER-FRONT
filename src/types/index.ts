// 基础类型定义
export interface MarketData {
  symbol: string;
  displayName: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
}

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  confidence: number;
  timestamp: number;
  description: string;
  status: 'ACTIVE' | 'EXECUTED' | 'EXPIRED';
}

export interface PortfolioStats {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayPnL: number;
  dayPnLPercent: number;
  activePositions: number;
}

export interface SystemStatus {
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  uptime: number;
  latency: number;
  activeSessions: number;
  lastUpdate: number;
}

// 实际API返回的OI统计数据结构
export interface OIStatistics {
  symbol: string;
  latest_oi: string;
  daily_change_pct: string;
  anomaly_count_24h: number;
  first_anomaly_time: string | null;
  last_anomaly_time: string | null;
  avg_oi_24h: string;
}

// API包装响应格式
export interface APIResponse<T> {
  success: boolean;
  data: T;
  params?: any;
  timestamp: string;
}

// Statistics API返回数据（apiClient自动解包）
export type OIStatisticsResponse = OIStatistics[];

// 实际API返回的异常数据结构
export interface OIAnomaly {
  symbol: string;
  period_minutes: number;
  percent_change: number;
  oi_before: string;
  oi_after: string;
  oi_change: string;
  severity: 'low' | 'medium' | 'high';
  anomaly_time: string;
  threshold_value: string;
}

// Anomalies API返回数据（apiClient自动解包）
export type OIAnomaliesResponse = OIAnomaly[];

// 实际API返回的状态结构
export interface OIStatusResponse {
  is_initialized: boolean;
  database_healthy: boolean;
  api_healthy: boolean;
  service_running: boolean;
  timestamp: string;
}

// OI服务状态响应（原始数据）
export interface OIServiceStatusData {
  is_running: boolean;
  active_symbols_count: number;
  uptime_ms: number;
  last_poll_time: string;
  config: {
    polling_interval_ms: number;
    enabled_symbols: string[];
  };
}

// OI服务状态API响应
export type OIServiceStatus = APIResponse<OIServiceStatusData>;

// 币种对象接口
export interface SymbolData {
  id: number;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  contract_type: string;
  status: string;
  enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

// 启用币种列表响应
export interface EnabledSymbolsResponse {
  success: boolean;
  data: SymbolData[];
  count: number;
  timestamp: string;
}

// OI监控配置响应
export interface OIConfigResponse {
  success: boolean;
  data: {
    polling_interval_ms: number;
    enabled_symbols: string[];
    anomaly_thresholds: {
      [key: string]: number;
    };
  };
  timestamp: string;
}

// OI快照数据
export interface OISnapshot {
  symbol: string;
  oi_value: number;
  timestamp: string;
}

// OI快照响应
export interface OISnapshotsResponse {
  success: boolean;
  data: OISnapshot[];
  count: number;
  params: {
    limit: number;
    order: string;
  };
  timestamp: string;
}

// 手动轮询响应
export interface ManualPollResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

// 配置更新响应
export interface ConfigUpdateResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

// 保留原有类型定义以防后续需要
export interface PollingServiceStatus {
  is_running: boolean;
  active_symbols_count: number;
  uptime_ms: number;
  last_poll_time: string;
}

export interface DataStatus {
  total_records: number;
  last_update: string;
}

// 系统监控相关类型
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  response_time: number;
  last_check: string;
  details?: Record<string, any>;
}

export interface SystemHealthResponse {
  overall_status: 'healthy' | 'unhealthy' | 'warning';
  checks: HealthCheck[];
  uptime: number;
  timestamp: string;
}

export interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    free: number;
    usage_percentage: number;
  };
  cpu: {
    usage_percentage: number;
    load_average: number[];
  };
  database: {
    mysql: {
      active_connections: number;
      max_connections: number;
      connection_usage_percentage: number;
      query_count: number;
      avg_query_time: number;
    };
    redis: {
      connected: boolean;
      memory_used: number;
      key_count: number;
      hit_rate: number;
    };
  };
  api: {
    request_count: number;
    error_count: number;
    avg_response_time: number;
    active_connections: number;
  };
  websocket: {
    connected: boolean;
    subscribed_streams: number;
    message_count: number;
    reconnect_count: number;
  };
}

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  resolved: boolean;
}

export interface AlertsResponse {
  alerts: Alert[];
  count: number;
  critical_count: number;
  warning_count: number;
}

// 系统统计信息 (基于实际API结构)
export interface SystemStats {
  system: {
    uptime: number;
    memory_usage: number;
    cpu_usage: number;
  };
  database: {
    mysql_connections: number;
    redis_connected: boolean;
    redis_memory_mb: number;
  };
  api: {
    total_requests: number;
    error_rate: number;
    avg_response_time: number;
  };
  websocket: {
    connected: boolean;
    streams: number;
    messages: number;
  };
  health: {
    overall_status: string;
    healthy_services: number;
    total_services: number;
  };
}

// 历史指标数据
export interface MetricsHistoryResponse {
  data: SystemMetrics[];
}