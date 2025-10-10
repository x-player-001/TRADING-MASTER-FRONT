/**
 * TOP币种配置API服务
 * 管理币种配置、订阅流、排序等功能
 */

import apiClient from './apiClient';

// ============ 类型定义 ============

export interface TopSymbolConfig {
  id: number;
  symbol: string;
  display_name: string;
  rank_order: number;
  enabled: boolean;
  subscription_intervals: string[];
  created_at: string;
  updated_at: string;
}

export interface TopSymbolCreateDTO {
  symbol: string;
  display_name: string;
  rank_order: number;
  enabled: boolean;
  subscription_intervals: string[];
}

export interface TopSymbolUpdateDTO {
  display_name?: string;
  rank_order?: number;
  enabled?: boolean;
  subscription_intervals?: string[];
}

export interface SymbolOrderDTO {
  symbol: string;
  rank_order: number;
}

export interface SymbolStatistics {
  total_symbols: number;
  enabled_symbols: number;
  disabled_symbols: number;
  total_intervals: number;
  total_streams: number;
}

export interface SubscriptionStream {
  stream: string;
  symbol: string;
  interval: string;
}

// ============ API接口 ============

class SymbolConfigAPI {
  private baseURL = '/api/top-symbols';

  /**
   * 获取所有币种配置
   */
  async getAllSymbols(): Promise<TopSymbolConfig[]> {
    // apiClient 已自动解包 response.data，直接返回即可
    return await apiClient.get<TopSymbolConfig[]>(this.baseURL);
  }

  /**
   * 获取启用的币种配置
   */
  async getEnabledSymbols(): Promise<TopSymbolConfig[]> {
    // apiClient 已自动解包 response.data，直接返回即可
    return await apiClient.get<TopSymbolConfig[]>(`${this.baseURL}/enabled`);
  }

  /**
   * 获取单个币种配置
   */
  async getSymbol(symbol: string): Promise<TopSymbolConfig> {
    // apiClient 已自动解包 response.data，直接返回即可
    return await apiClient.get<TopSymbolConfig>(`${this.baseURL}/${symbol}`);
  }

  /**
   * 创建币种配置
   */
  async createSymbol(data: TopSymbolCreateDTO): Promise<{ id: number; symbol: string }> {
    // apiClient 已自动解包 response.data，直接返回即可
    return await apiClient.post<{ id: number; symbol: string }>(this.baseURL, data);
  }

  /**
   * 更新币种配置
   */
  async updateSymbol(symbol: string, data: TopSymbolUpdateDTO): Promise<void> {
    await apiClient.put(`${this.baseURL}/${symbol}`, data);
  }

  /**
   * 删除币种配置
   */
  async deleteSymbol(symbol: string): Promise<void> {
    await apiClient.delete(`${this.baseURL}/${symbol}`);
  }

  /**
   * 批量更新排序
   */
  async batchUpdateOrder(orders: SymbolOrderDTO[]): Promise<void> {
    await apiClient.put(`${this.baseURL}/batch/order`, orders);
  }

  /**
   * 启用/禁用币种
   */
  async toggleSymbol(symbol: string, enabled: boolean): Promise<void> {
    await apiClient.put(`${this.baseURL}/${symbol}/toggle`, { enabled });
  }

  /**
   * 获取订阅流配置
   */
  async getSubscriptionStreams(): Promise<string[]> {
    // apiClient 已自动解包 response.data，直接返回即可
    return await apiClient.get<string[]>(`${this.baseURL}/subscription/streams`);
  }

  /**
   * 获取统计信息
   */
  async getStatistics(): Promise<SymbolStatistics> {
    // apiClient 已自动解包 response.data，直接返回即可
    return await apiClient.get<SymbolStatistics>(`${this.baseURL}/statistics`);
  }
}

// 导出单例
export const symbolConfigAPI = new SymbolConfigAPI();

// 导出工具函数
export const symbolConfigUtils = {
  /**
   * 格式化订阅流名称
   */
  formatStreamName(stream: string): string {
    // btcusdt@kline_15m => BTC/USDT (15m)
    const [symbol, type] = stream.split('@');
    const interval = type.replace('kline_', '');
    return `${symbol.toUpperCase()} (${interval})`;
  },

  /**
   * 解析订阅流
   */
  parseStream(stream: string): { symbol: string; interval: string } {
    const [symbol, type] = stream.split('@');
    const interval = type.replace('kline_', '');
    return { symbol: symbol.toUpperCase(), interval };
  },

  /**
   * 构建订阅流名称
   */
  buildStreamName(symbol: string, interval: string): string {
    return `${symbol.toLowerCase()}@kline_${interval}`;
  },

  /**
   * 验证币种符号格式
   */
  validateSymbol(symbol: string): boolean {
    // 必须以USDT结尾且长度合理
    return /^[A-Z0-9]+USDT$/.test(symbol) && symbol.length >= 6 && symbol.length <= 20;
  },

  /**
   * 获取可用的时间周期
   */
  getAvailableIntervals(): string[] {
    return ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];
  },

  /**
   * 格式化时间周期显示
   */
  formatInterval(interval: string): string {
    const map: { [key: string]: string } = {
      '1m': '1分钟',
      '3m': '3分钟',
      '5m': '5分钟',
      '15m': '15分钟',
      '30m': '30分钟',
      '1h': '1小时',
      '2h': '2小时',
      '4h': '4小时',
      '6h': '6小时',
      '12h': '12小时',
      '1d': '1天',
    };
    return map[interval] || interval;
  },
};
