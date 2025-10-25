import { blockchainGet, blockchainPost, blockchainPatch, blockchainDelete, blockchainPut } from './blockchainApiClient';
import type {
  Token,
  TokenListResponse,
  DexScreenerToken,
  DexScreenerTokenListResponse,
  DexScreenerTokenListParams,
  PotentialToken,
  PotentialTokenListResponse,
  PotentialTokenParams,
  AddToMonitorRequest,
  PriceAlert,
  PriceAlertListResponse,
  PriceAlertParams,
  MonitorToken,
  MonitorTokenListResponse,
  MonitorTokenParams,
  OHLCV,
  StatsResponse,
  HealthResponse,
  SearchResponse,
  TokenListParams,
  OHLCVParams,
  SearchParams,
  ScraperConfig,
  UpdateScraperConfigRequest,
  AddMonitorByPairRequest
} from '../types/blockchain';

class BlockchainAPIService {
  // ========== 潜力代币接口 ==========

  /**
   * 获取潜力代币列表
   */
  async getPotentialTokens(params?: PotentialTokenParams): Promise<PotentialTokenListResponse> {
    return blockchainGet<PotentialTokenListResponse>('/api/potential-tokens', { params });
  }

  /**
   * 从潜力代币添加到监控
   */
  async addToMonitor(data: AddToMonitorRequest): Promise<any> {
    return blockchainPost('/api/monitor/add-from-potential', data);
  }

  /**
   * 删除潜力代币
   */
  async deletePotentialToken(id: string): Promise<any> {
    return blockchainDelete(`/api/potential-tokens/${id}`);
  }

  /**
   * 获取已删除的潜力代币列表
   */
  async getDeletedPotentialTokens(params?: PotentialTokenParams): Promise<PotentialTokenListResponse> {
    return blockchainGet<PotentialTokenListResponse>('/api/potential-tokens/deleted', { params });
  }

  /**
   * 恢复已删除的潜力代币
   */
  async restorePotentialToken(id: string): Promise<any> {
    return blockchainPost(`/api/potential-tokens/${id}/restore`, {});
  }

  // ========== 价格报警接口 ==========

  /**
   * 获取价格报警列表
   */
  async getPriceAlerts(params?: PriceAlertParams): Promise<PriceAlertListResponse> {
    return blockchainGet<PriceAlertListResponse>('/api/monitor/alerts', { params });
  }

  /**
   * 确认价格报警
   */
  async acknowledgePriceAlert(alertId: string): Promise<any> {
    return blockchainPost(`/api/monitor/alerts/${alertId}/acknowledge`, {});
  }

  // ========== 监控代币接口 ==========

  /**
   * 更新监控代币的报警阈值
   */
  async updateMonitorTokenThresholds(tokenId: string, thresholds: number[]): Promise<any> {
    return blockchainPatch(`/api/monitor/tokens/${tokenId}/thresholds`, {
      alert_thresholds: thresholds
    });
  }

  // ========== 监控代币接口 ==========

  /**
   * 获取监控代币列表
   */
  async getMonitorTokens(params?: MonitorTokenParams): Promise<MonitorTokenListResponse> {
    return blockchainGet<MonitorTokenListResponse>('/api/monitor/tokens', { params });
  }

  /**
   * 删除监控代币
   */
  async deleteMonitorToken(id: string): Promise<any> {
    return blockchainDelete(`/api/monitor/tokens/${id}`);
  }

  /**
   * 获取已删除的监控代币列表
   */
  async getDeletedMonitorTokens(params?: MonitorTokenParams): Promise<MonitorTokenListResponse> {
    return blockchainGet<MonitorTokenListResponse>('/api/monitor/tokens/deleted', { params });
  }

  /**
   * 恢复已删除的监控代币
   */
  async restoreMonitorToken(id: string): Promise<any> {
    return blockchainPost(`/api/monitor/tokens/${id}/restore`, {});
  }

  // ========== DexScreener 接口 ==========

  /**
   * 获取DexScreener代币列表（支持排序和筛选）
   */
  async getDexScreenerTokenList(params?: DexScreenerTokenListParams): Promise<DexScreenerTokenListResponse> {
    return blockchainGet<DexScreenerTokenListResponse>('/api/dexscreener/tokens', { params });
  }

  /**
   * 获取DexScreener交易对详情
   */
  async getDexScreenerPairDetail(pairAddress: string): Promise<DexScreenerToken> {
    return blockchainGet<DexScreenerToken>(`/api/dexscreener/pairs/${pairAddress}`);
  }

  /**
   * 搜索DexScreener代币
   */
  async searchDexScreenerTokens(params: SearchParams): Promise<DexScreenerTokenListResponse> {
    return blockchainGet<DexScreenerTokenListResponse>('/api/dexscreener/search', { params });
  }

  // ========== 旧接口（保留兼容） ==========

  /**
   * 获取代币列表（旧接口）
   */
  async getTokenList(params?: TokenListParams): Promise<TokenListResponse> {
    return blockchainGet<TokenListResponse>('/api/tokens', { params });
  }

  /**
   * 获取代币详情（旧接口）
   */
  async getTokenDetail(address: string): Promise<Token> {
    return blockchainGet<Token>(`/api/tokens/${address}`);
  }

  /**
   * 获取代币OHLCV数据
   */
  async getTokenOHLCV(address: string, params?: OHLCVParams): Promise<OHLCV[]> {
    return blockchainGet<OHLCV[]>(`/api/tokens/${address}/ohlcv`, { params });
  }

  /**
   * 搜索代币（旧接口）
   */
  async searchTokens(params: SearchParams): Promise<SearchResponse> {
    return blockchainGet<SearchResponse>('/api/search', { params });
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<StatsResponse> {
    return blockchainGet<StatsResponse>('/api/stats');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthResponse> {
    return blockchainGet<HealthResponse>('/health');
  }

  // ========== 爬虫配置接口 ==========

  /**
   * 获取爬虫配置
   */
  async getScraperConfig(): Promise<ScraperConfig> {
    return blockchainGet<ScraperConfig>('/api/scraper/config');
  }

  /**
   * 更新爬虫配置
   */
  async updateScraperConfig(config: UpdateScraperConfigRequest): Promise<ScraperConfig> {
    return blockchainPut<ScraperConfig>('/api/scraper/config', config);
  }

  // ========== 手动添加监控 ==========

  /**
   * 通过pair地址手动添加监控
   */
  async addMonitorByPair(request: AddMonitorByPairRequest): Promise<any> {
    return blockchainPost('/api/monitor/add-by-pair', request);
  }

  // ========== 彻底删除 ==========

  /**
   * 彻底删除监控代币
   */
  async permanentDeleteMonitorToken(tokenId: string): Promise<any> {
    return blockchainDelete(`/api/monitor/tokens/${tokenId}/permanent`);
  }

  /**
   * 彻底删除潜力代币
   */
  async permanentDeletePotentialToken(tokenId: string): Promise<any> {
    return blockchainDelete(`/api/potential-tokens/${tokenId}/permanent`);
  }
}

// 创建单例实例
export const blockchainAPI = new BlockchainAPIService();

// 导出服务类
export default BlockchainAPIService;
