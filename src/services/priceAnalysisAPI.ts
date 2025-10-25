import { priceAnalysisGet } from './priceAnalysisApiClient';
import type {
  PriceSwing,
  PriceSwingListResponse,
  TokenSwingStats,
  TokenSwingStatsListResponse,
  PriceSwingParams,
  TokenSwingStatsParams
} from '../types/blockchain';

class PriceAnalysisAPIService {
  /**
   * 获取价格波动列表
   * 支持多种过滤和排序条件
   */
  async getPriceSwings(params?: PriceSwingParams): Promise<PriceSwingListResponse> {
    return priceAnalysisGet<PriceSwingListResponse>('/api/price-swings', { params });
  }

  /**
   * 获取代币波动统计
   * 包括总波动次数、最大涨跌幅等
   */
  async getTokenSwingStats(params?: TokenSwingStatsParams): Promise<TokenSwingStatsListResponse> {
    return priceAnalysisGet<TokenSwingStatsListResponse>('/api/price-swings/stats', { params });
  }

  /**
   * 获取最大涨幅 TOP N
   * @param limit 返回数量，默认10，最大100
   */
  async getTopRises(limit: number = 10): Promise<PriceSwing[]> {
    return priceAnalysisGet<PriceSwing[]>('/api/price-swings/top-rises', {
      params: { limit }
    });
  }

  /**
   * 获取最大跌幅 TOP N
   * @param limit 返回数量，默认10，最大100
   */
  async getTopFalls(limit: number = 10): Promise<PriceSwing[]> {
    return priceAnalysisGet<PriceSwing[]>('/api/price-swings/top-falls', {
      params: { limit }
    });
  }

  /**
   * 获取指定代币的波动记录
   * @param tokenId 代币ID
   * @param symbol 代币符号
   */
  async getTokenPriceSwings(tokenId?: string, symbol?: string, params?: Omit<PriceSwingParams, 'token_id' | 'symbol'>): Promise<PriceSwingListResponse> {
    return this.getPriceSwings({
      ...params,
      token_id: tokenId,
      symbol: symbol
    });
  }

  /**
   * 获取指定代币的波动统计
   * 通过symbol查询后获取统计信息
   */
  async getTokenSwingStat(symbol: string): Promise<TokenSwingStats | null> {
    const response = await this.getTokenSwingStats({
      page: 1,
      page_size: 1
    });

    // 由于API不支持按symbol过滤stats，需要通过getPriceSwings获取token_id后再查询
    // 或者直接从stats列表中找到对应的symbol
    const stat = response.data.find(s => s.token_symbol === symbol);
    return stat || null;
  }
}

// 创建单例实例
export const priceAnalysisAPI = new PriceAnalysisAPIService();

// 导出服务类
export default PriceAnalysisAPIService;
