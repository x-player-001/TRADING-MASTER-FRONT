import { apiGet, apiPost, apiDelete } from './apiClient';

// 类型定义
export interface PatternScanTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  interval_type: string;
  lookback_bars: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_symbols?: number;
  scanned_symbols?: number;
  found_patterns?: number;
}

export interface PatternResult {
  id: number;
  task_id: string;
  symbol: string;
  pattern_type: string;
  score: number;
  description: string;
  key_levels: {
    swing_low?: number;
    swing_high?: number;
    support?: number;
    resistance?: number;
    target?: number;
    stop_loss?: number;
  };
  kline_interval: string;
  detected_at: number;
  created_at: string;
}

export interface PatternType {
  type: string;
  name: string;
  description: string;
  category: 'reversal' | 'continuation' | 'bilateral';
}

// 回调扫描参数
export interface PullbackScanParams {
  interval?: string;
  lookback_bars?: number;
  min_surge_pct?: number;
  max_retrace_pct?: number;
}

// 横盘震荡扫描参数
export interface ConsolidationScanParams {
  interval?: string;
  min_bars?: number;
  max_range_pct?: number;
  require_fake_breakdown?: boolean;
}

// 双底扫描参数
export interface DoubleBottomScanParams {
  interval?: string;
  lookback_bars?: number;
  min_bars_between?: number;
  bottom_tolerance_pct?: number;
}

// 扫描结果项
export interface ScanResultItem {
  symbol: string;
  score: number;
  description?: string;
  kline_interval?: string;
  detected_at?: number;
  key_levels?: {
    swing_low?: number;
    swing_high?: number;
    support?: number;
    resistance?: number;
    target?: number;
    stop_loss?: number;
    bottom1?: number;
    bottom2?: number;
    neckline?: number;
  };
  // 回调扫描特有字段
  surge_pct?: number;
  retrace_pct?: number;
  // 横盘震荡特有字段
  range_pct?: number;
  consolidation_bars?: number;
  has_fake_breakdown?: boolean;
  // 双底特有字段
  bottom1_price?: number;
  bottom2_price?: number;
  neckline_price?: number;
  // 通用字段
  current_price?: number;
}

class PatternScanAPIService {
  private baseUrl = '/api/pattern-scan';

  // 启动扫描
  async startScan(params: {
    interval_type: string;
    lookback_bars: number;
  }): Promise<PatternScanTask> {
    return apiPost<PatternScanTask>(`${this.baseUrl}/start`, params);
  }

  // 获取任务列表
  async getTasks(params?: {
    status?: string;
    limit?: number;
  }): Promise<PatternScanTask[]> {
    return apiGet<PatternScanTask[]>(`${this.baseUrl}/tasks`, { params });
  }

  // 获取任务状态
  async getTaskStatus(taskId: string): Promise<PatternScanTask> {
    return apiGet<PatternScanTask>(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`);
  }

  // 获取扫描结果
  async getResults(taskId: string, params?: {
    pattern_type?: string;
    direction?: 'bullish' | 'bearish' | 'neutral';
    min_confidence?: number;
  }): Promise<PatternResult[]> {
    return apiGet<PatternResult[]>(`${this.baseUrl}/results/${taskId}`, { params });
  }

  // 获取最新结果
  async getLatestResults(params?: {
    pattern_type?: string;
    direction?: 'bullish' | 'bearish' | 'neutral';
    min_confidence?: number;
    limit?: number;
  }): Promise<PatternResult[]> {
    return apiGet<PatternResult[]>(`${this.baseUrl}/latest`, { params });
  }

  // 获取支持的形态类型
  async getPatternTypes(): Promise<PatternType[]> {
    return apiGet<PatternType[]>(`${this.baseUrl}/pattern-types`);
  }

  // 删除所有扫描结果和任务
  async deleteAll(): Promise<{ deleted_results: number; deleted_tasks: number }> {
    return apiDelete<{ deleted_results: number; deleted_tasks: number }>(`${this.baseUrl}/all`);
  }

  // 获取黑名单列表
  async getBlacklist(): Promise<string[]> {
    return apiGet<string[]>(`${this.baseUrl}/blacklist`);
  }

  // 添加币种到黑名单
  async addToBlacklist(symbol: string): Promise<{ symbol: string }> {
    return apiPost<{ symbol: string }>(`${this.baseUrl}/blacklist`, { symbol });
  }

  // 从黑名单移除币种
  async removeFromBlacklist(symbol: string): Promise<void> {
    return apiDelete(`${this.baseUrl}/blacklist/${encodeURIComponent(symbol)}`);
  }

  // 回调扫描
  async scanPullback(params?: PullbackScanParams): Promise<ScanResultItem[]> {
    const response = await apiPost<{ params: PullbackScanParams; results: ScanResultItem[] } | ScanResultItem[]>(
      `${this.baseUrl}/pullback`, params || {}
    );
    // 兼容两种返回格式
    if (response && typeof response === 'object' && 'results' in response) {
      return response.results || [];
    }
    return Array.isArray(response) ? response : [];
  }

  // 横盘震荡扫描
  async scanConsolidation(params?: ConsolidationScanParams): Promise<ScanResultItem[]> {
    const response = await apiPost<{ params: ConsolidationScanParams; results: ScanResultItem[] } | ScanResultItem[]>(
      `${this.baseUrl}/consolidation`, params || {}
    );
    if (response && typeof response === 'object' && 'results' in response) {
      return response.results || [];
    }
    return Array.isArray(response) ? response : [];
  }

  // 双底扫描
  async scanDoubleBottom(params?: DoubleBottomScanParams): Promise<ScanResultItem[]> {
    const response = await apiPost<{ params: DoubleBottomScanParams; results: ScanResultItem[] } | ScanResultItem[]>(
      `${this.baseUrl}/double-bottom`, params || {}
    );
    if (response && typeof response === 'object' && 'results' in response) {
      return response.results || [];
    }
    return Array.isArray(response) ? response : [];
  }
}

export const patternScanAPI = new PatternScanAPIService();
export default PatternScanAPIService;
