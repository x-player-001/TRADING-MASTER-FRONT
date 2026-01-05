import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

// 类型定义
export interface VolumeMonitorSymbol {
  id: number;
  symbol: string;
  enabled: boolean;
  volume_multiplier: number;
  lookback_bars: number;
  min_volume_usdt: number;
  created_at: string;
  updated_at: string;
}

export interface VolumeAlert {
  id: number;
  symbol: string;
  kline_time: number;
  current_volume: number;
  avg_volume: number;
  volume_ratio: number;
  price_change_pct: number;
  direction: 'UP' | 'DOWN';
  current_price: number;
  created_at: string;
  daily_alert_index?: number;  // 当日第N次报警
  is_important?: boolean;      // 是否重要报警
}

export interface VolumeMonitorConfig {
  volume_multiplier?: number;
  lookback_bars?: number;
  min_volume_usdt?: number;
}

export interface PatternAlert {
  symbol: string;
  kline_time: number;
  pattern_type: string;
  current_price: number;
  price_change_pct: number;
  ema120: number;
  lower_shadow_pct: number;
  upper_shadow_pct: number;
  is_final: boolean;
  daily_alert_index: number;
  created_at: string;
}

class VolumeMonitorAPIService {
  private baseUrl = '/api/volume-monitor';

  // 获取监控列表
  async getSymbols(): Promise<VolumeMonitorSymbol[]> {
    return apiGet<VolumeMonitorSymbol[]>(`${this.baseUrl}/symbols`);
  }

  // 添加监控币种
  async addSymbol(data: {
    symbol: string;
    volume_multiplier?: number;
    lookback_bars?: number;
    min_volume_usdt?: number;
  }): Promise<VolumeMonitorSymbol> {
    return apiPost<VolumeMonitorSymbol>(`${this.baseUrl}/symbols`, data);
  }

  // 更新配置
  async updateSymbol(symbol: string, data: Partial<VolumeMonitorConfig>): Promise<VolumeMonitorSymbol> {
    return apiPut<VolumeMonitorSymbol>(`${this.baseUrl}/symbols/${symbol}`, data);
  }

  // 删除监控
  async deleteSymbol(symbol: string): Promise<void> {
    return apiDelete(`${this.baseUrl}/symbols/${symbol}`);
  }

  // 启用/禁用监控
  async toggleSymbol(symbol: string): Promise<VolumeMonitorSymbol> {
    return apiPut<VolumeMonitorSymbol>(`${this.baseUrl}/symbols/${symbol}/toggle`);
  }

  // 批量添加
  async batchAddSymbols(symbols: string[]): Promise<{ success: string[]; failed: string[] }> {
    return apiPost<{ success: string[]; failed: string[] }>(`${this.baseUrl}/symbols/batch`, { symbols });
  }

  // 查询报警记录
  async getAlerts(params?: {
    symbol?: string;
    alert_type?: 'spike' | 'drop';
    start_time?: string;
    end_time?: string;
    limit?: number;
    date?: string;  // 日期参数，格式 YYYY-MM-DD
  }): Promise<VolumeAlert[]> {
    return apiGet<VolumeAlert[]>(`${this.baseUrl}/alerts`, { params });
  }

  // 查询形态报警记录
  async getPatternAlerts(params?: {
    symbol?: string;
    date?: string;
    start_time?: number;
    end_time?: number;
    pattern_type?: string;
    is_final?: boolean;
    limit?: number;
  }): Promise<PatternAlert[]> {
    return apiGet<PatternAlert[]>(`${this.baseUrl}/pattern-alerts`, { params });
  }
}

export const volumeMonitorAPI = new VolumeMonitorAPIService();
export default VolumeMonitorAPIService;
