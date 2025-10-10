/**
 * 市场数据API服务
 * 获取市场概览、币种价格、成交量等数据
 */

import { apiGet } from './apiClient';
import { symbolConfigAPI } from './symbolConfigAPI';
import { klineAPI } from './klineAPI';

// ============ 类型定义 ============

export interface MarketDataItem {
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

export interface MarketOverviewResponse {
  data: MarketDataItem[];
  timestamp: number;
}

// ============ API接口 ============

class MarketAPI {
  /**
   * 获取市场概览数据
   * 通过批量获取TOP币种的K线数据来计算市场概览
   * @param limit 返回币种数量，默认10
   */
  async getMarketOverview(limit = 10): Promise<MarketDataItem[]> {
    try {
      // 1. 获取启用的TOP币种列表
      const symbols = await symbolConfigAPI.getEnabledSymbols();

      // 取前N个币种
      const topSymbols = symbols
        .sort((a, b) => a.rank_order - b.rank_order)
        .slice(0, limit)
        .map(s => s.symbol);

      if (topSymbols.length === 0) {
        console.warn('⚠️ 没有启用的币种配置');
        return [];
      }

      // 2. 批量获取这些币种的最新K线数据（1小时周期，获取24根K线用于计算24小时数据）
      // ⚠️ 注意：apiClient已自动解包，直接得到 BatchLatestKlinesResponse 类型
      const batchResult = await klineAPI.batchGetLatest(topSymbols, '1h', 24);

      console.log('📊 批量获取K线结果:', batchResult);

      // 3. 转换为市场数据格式
      const marketData: MarketDataItem[] = [];

      // 🔥 关键修复：从 results 数组中查找对应币种的数据，而不是直接访问 batchResult[symbol]
      for (const symbol of topSymbols) {
        // 从 results 数组中找到对应币种的结果
        const result = batchResult.results.find(r => r.symbol === symbol);

        if (!result || !result.success || !result.klines || result.klines.length === 0) {
          console.warn(`⚠️ 币种 ${symbol} 没有K线数据`, result);
          continue;
        }

        // 计算24小时统计数据
        const stats = this.calculateMarketStats(result.klines);

        // 查找对应的币种配置获取显示名称
        const config = symbols.find(s => s.symbol === symbol);

        marketData.push({
          symbol,
          displayName: config?.display_name || symbol.replace('USDT', ''),
          price: stats.latestPrice,
          change24h: stats.change24h,
          changePercent24h: stats.changePercent24h,
          volume24h: stats.volume24h,
          high24h: stats.high24h,
          low24h: stats.low24h,
          marketCap: undefined, // 市值数据需要其他API提供
        });
      }

      console.log(`✅ 成功处理 ${marketData.length} 个币种的市场数据`);
      return marketData;
    } catch (error) {
      console.error('❌ 获取市场概览数据失败:', error);
      throw error;
    }
  }

  /**
   * 计算市场统计数据
   * @param klines K线数据数组
   */
  private calculateMarketStats(klines: any[]) {
    if (klines.length === 0) {
      return {
        latestPrice: 0,
        change24h: 0,
        changePercent24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
      };
    }

    // 按时间排序（确保数据顺序正确）
    const sortedKlines = [...klines].sort((a, b) => a.open_time - b.open_time);

    const latest = sortedKlines[sortedKlines.length - 1];
    const first = sortedKlines[0];

    const latestPrice = parseFloat(latest.close);
    const firstPrice = parseFloat(first.open);
    const change24h = latestPrice - firstPrice;
    const changePercent24h = firstPrice !== 0 ? (change24h / firstPrice) * 100 : 0;

    const high24h = Math.max(...sortedKlines.map((k) => parseFloat(k.high)));
    const low24h = Math.min(...sortedKlines.map((k) => parseFloat(k.low)));
    const volume24h = sortedKlines.reduce((sum, k) => sum + parseFloat(k.volume), 0);

    return {
      latestPrice,
      change24h,
      changePercent24h,
      high24h,
      low24h,
      volume24h,
    };
  }

  /**
   * 获取单个币种的市场数据
   * @param symbol 币种符号
   */
  async getSingleMarketData(symbol: string): Promise<MarketDataItem | null> {
    try {
      // 获取24小时K线数据
      const response = await klineAPI.getLatestKlines(symbol, '1h', 24);

      if (!response.klines || response.klines.length === 0) {
        console.warn(`⚠️ 币种 ${symbol} 没有K线数据`);
        return null;
      }

      // 计算统计数据
      const stats = this.calculateMarketStats(response.klines);

      // 获取显示名称
      const config = await symbolConfigAPI.getSymbol(symbol).catch(() => null);

      return {
        symbol,
        displayName: config?.display_name || symbol.replace('USDT', ''),
        price: stats.latestPrice,
        change24h: stats.change24h,
        changePercent24h: stats.changePercent24h,
        volume24h: stats.volume24h,
        high24h: stats.high24h,
        low24h: stats.low24h,
        marketCap: undefined,
      };
    } catch (error) {
      console.error(`❌ 获取币种 ${symbol} 市场数据失败:`, error);
      return null;
    }
  }
}

// 导出单例
export const marketAPI = new MarketAPI();

// 导出工具函数
export const marketUtils = {
  /**
   * 格式化价格显示
   */
  formatPrice(price: number): string {
    if (price >= 1) {
      return price.toFixed(2);
    } else if (price >= 0.01) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  },

  /**
   * 格式化涨跌幅
   */
  formatChangePercent(percent: number): string {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  },

  /**
   * 格式化成交量（显示为M/B单位）
   */
  formatVolume(volume: number): string {
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  },

  /**
   * 判断涨跌
   */
  isPositive(change: number): boolean {
    return change >= 0;
  },
};
