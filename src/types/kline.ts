// K线数据相关类型定义

/**
 * K线原始数据项 (后端API返回格式)
 */
export interface KlineItem {
  open_time: number;      // 开盘时间戳(毫秒)
  close_time: number;     // 收盘时间戳(毫秒)
  open: string;           // 开盘价
  high: string;           // 最高价
  low: string;            // 最低价
  close: string;          // 收盘价
  volume: string;         // 成交量
  trade_count: number;    // 交易次数
}

/**
 * K线响应数据结构 (apiClient自动解包后)
 */
export interface KlineResponse {
  symbol: string;         // 币种符号
  interval: string;       // 时间周期
  count: number;          // K线数量
  storage_type?: string;  // 存储类型
  klines: KlineItem[];    // K线数据数组
  start_time?: number;    // 开始时间(范围查询时)
  end_time?: number;      // 结束时间(范围查询时)
}

/**
 * TradingView Lightweight Charts 蜡烛图数据格式
 */
export interface CandlestickData {
  time: number;           // Unix时间戳(秒)
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * TradingView Lightweight Charts 成交量数据格式
 */
export interface VolumeData {
  time: number;           // Unix时间戳(秒)
  value: number;          // 成交量
  color?: string;         // 颜色(涨绿/跌红)
}

/**
 * K线时间周期类型
 */
export type KlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * K线统计信息
 */
export interface KlineStatistics {
  symbol: string;
  storage: Record<string, {
    count: number;
    oldest: string;
    newest: string;
  }>;
  supported_intervals: KlineInterval[];
}

/**
 * K线数据完整性检查结果
 */
export interface KlineIntegrity {
  symbol: string;
  interval: string;
  days_checked: number;
  expected_count: number;
  actual_count: number;
  missing_count: number;
  completeness_rate: number;   // 完整度百分比
  missing_ranges?: Array<{
    start: number;
    end: number;
  }>;
}

/**
 * TOP币种K线概览项
 */
export interface TopSymbolKlineOverview {
  symbol: string;
  display_name: string;
  rank_order: number;
  latest_kline: KlineItem | null;
  has_data: boolean;
}

/**
 * TOP币种K线概览响应
 */
export interface TopSymbolsOverviewResponse {
  interval: string;
  overview: TopSymbolKlineOverview[];
}

/**
 * 批量获取最新K线的单个结果
 */
export interface BatchKlineResult {
  symbol: string;
  success: boolean;
  count: number;
  klines: KlineItem[];
  error?: string;
}

/**
 * 批量获取最新K线响应
 */
export interface BatchLatestKlinesResponse {
  interval: string;
  requested_symbols: number;
  results: BatchKlineResult[];
}

/**
 * 支持的时间周期配置响应
 */
export interface SupportedIntervalsResponse {
  supported_intervals: KlineInterval[];
}

/**
 * K线数据转换工具函数的返回类型
 */
export interface ConvertedKlineData {
  candlesticks: CandlestickData[];
  volumes: VolumeData[];
}
