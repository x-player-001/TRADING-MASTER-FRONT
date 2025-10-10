/**
 * 历史数据API服务
 * 用于获取和管理历史K线数据
 */

import apiClient from './apiClient';

/**
 * 历史K线数据响应
 */
export interface HistoricalKlineResponse {
  symbol: string;
  interval: string;
  count: number;
  start_time?: number;
  end_time?: number;
  klines: any[]; // K线数据数组
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  total_cached_symbols: number;
  total_cached_intervals: number;
  cache_size_mb: number;
  hit_rate: number;
  symbols: Array<{
    symbol: string;
    intervals: string[];
    total_records: number;
  }>;
}

/**
 * 预加载响应
 */
export interface PreloadResponse {
  success: boolean;
  message: string;
  timestamp: number;
}

/**
 * 回溯补全请求参数
 */
export interface BackfillRequest {
  symbol: string;
  interval?: string;
  batch_size?: number;
}

/**
 * 回溯补全响应
 */
export interface BackfillResponse {
  success: boolean;
  mode: 'initial_load' | 'backfill';
  fetched_count: number;
  time_range: {
    start: string;
    end: string;
  };
  database_status: {
    earliest_before: string | null;
    earliest_after: string;
    total_records: number;
  };
  message: string;
}

class HistoricalAPI {
  private baseURL = '/api/historical';

  /**
   * 获取历史K线数据
   * @param symbol 币种符号 (e.g., 'BTCUSDT')
   * @param interval 时间周期 (默认 '1m')
   * @param startTime 开始时间戳(毫秒)
   * @param endTime 结束时间戳(毫秒)
   * @param limit 返回数据条数 (默认300, 最大1000)
   */
  async getKlines(
    symbol: string,
    interval: string = '1m',
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<HistoricalKlineResponse> {
    const params: any = { interval };
    if (startTime) params.start_time = startTime;
    if (endTime) params.end_time = endTime;
    if (limit) params.limit = limit;

    // apiClient自动解包，直接返回data
    return await apiClient.get<HistoricalKlineResponse>(
      `${this.baseURL}/klines/${symbol}`,
      { params }
    );
  }

  /**
   * 获取最新K线数据
   * @param symbol 币种符号
   * @param interval 时间周期 (默认 '1m')
   * @param limit 返回数据条数 (默认100, 最大500)
   */
  async getLatestKlines(
    symbol: string,
    interval: string = '1m',
    limit: number = 100
  ): Promise<HistoricalKlineResponse> {
    const params = { interval, limit };

    return await apiClient.get<HistoricalKlineResponse>(
      `${this.baseURL}/klines/${symbol}/latest`,
      { params }
    );
  }

  /**
   * 按时间范围获取K线数据
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param startTime 开始时间戳(毫秒) - 必填
   * @param endTime 结束时间戳(毫秒) - 必填
   */
  async getKlinesRange(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<HistoricalKlineResponse> {
    const params = {
      interval,
      start_time: startTime,
      end_time: endTime,
    };

    return await apiClient.get<HistoricalKlineResponse>(
      `${this.baseURL}/klines/${symbol}/range`,
      { params }
    );
  }

  /**
   * 预加载热门币种历史数据
   * 用于在系统启动时或需要时预热缓存
   */
  async preloadPopularSymbols(): Promise<PreloadResponse> {
    return await apiClient.post<PreloadResponse>(`${this.baseURL}/preload/popular`);
  }

  /**
   * 获取缓存统计信息
   * 用于监控历史数据缓存状态
   */
  async getCacheStats(): Promise<CacheStats> {
    return await apiClient.get<CacheStats>(`${this.baseURL}/cache/stats`);
  }

  /**
   * 回溯补全历史K线数据 ⭐ 新增
   * 自动从数据库最早时间向前拉取历史数据
   * @param request 回溯请求参数
   * @returns 拉取结果和统计信息
   */
  async backfill(request: BackfillRequest): Promise<BackfillResponse> {
    return await apiClient.post<BackfillResponse>(`${this.baseURL}/backfill`, request);
  }
}

// 导出单例
export const historicalAPI = new HistoricalAPI();

// 工具函数
export const historicalUtils = {
  /**
   * 计算时间范围
   * @param hours 向前推算的小时数
   * @returns { startTime, endTime }
   */
  getTimeRange(hours: number): { startTime: number; endTime: number } {
    const endTime = Date.now();
    const startTime = endTime - hours * 60 * 60 * 1000;
    return { startTime, endTime };
  },

  /**
   * 格式化缓存大小
   */
  formatCacheSize(sizeMB: number): string {
    if (sizeMB < 1) {
      return `${(sizeMB * 1024).toFixed(2)} KB`;
    }
    if (sizeMB < 1024) {
      return `${sizeMB.toFixed(2)} MB`;
    }
    return `${(sizeMB / 1024).toFixed(2)} GB`;
  },

  /**
   * 格式化命中率
   */
  formatHitRate(rate: number): string {
    return `${rate.toFixed(1)}%`;
  },
};
