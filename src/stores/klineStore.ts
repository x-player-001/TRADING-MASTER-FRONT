/**
 * K线数据状态管理 (Zustand)
 */

import { create } from 'zustand';
import type { KlineItem, KlineInterval, KlineIntegrity } from '../types/kline';

/**
 * K线状态接口
 */
interface KlineState {
  // 状态数据
  selectedSymbol: string;           // 当前选中的币种
  selectedInterval: KlineInterval;  // 当前选中的时间周期
  klines: KlineItem[];              // K线数据
  isLoading: boolean;               // 加载状态
  error: string | null;             // 错误信息
  lastUpdate: number | null;        // 最后更新时间戳
  integrity: KlineIntegrity | null; // 数据完整性信息
  autoRefresh: boolean;             // 是否自动刷新

  // 统计数据 (基于当前K线计算)
  stats: {
    latestPrice: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
  };

  // Actions
  setSymbol: (symbol: string) => void;
  setInterval: (interval: KlineInterval) => void;
  setKlines: (klines: KlineItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIntegrity: (integrity: KlineIntegrity | null) => void;
  setAutoRefresh: (autoRefresh: boolean) => void;
  updateStats: (stats: any) => void;
  reset: () => void;
}

/**
 * 初始状态
 */
const initialState = {
  selectedSymbol: 'BTCUSDT',
  selectedInterval: '5m' as KlineInterval,
  klines: [],
  isLoading: false,
  error: null,
  lastUpdate: null,
  integrity: null,
  autoRefresh: true,
  stats: {
    latestPrice: 0,
    change24h: 0,
    changePercent24h: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
  },
};

/**
 * K线状态管理Store
 */
export const useKlineStore = create<KlineState>((set) => ({
  ...initialState,

  // 设置选中币种
  setSymbol: (symbol: string) => {
    set({ selectedSymbol: symbol, klines: [], error: null });
  },

  // 设置时间周期
  setInterval: (interval: KlineInterval) => {
    set({ selectedInterval: interval, klines: [], error: null });
  },

  // 设置K线数据
  setKlines: (klines: KlineItem[]) => {
    set({
      klines,
      lastUpdate: Date.now(),
      error: null,
    });
  },

  // 设置加载状态
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  // 设置错误信息
  setError: (error: string | null) => {
    set({ error, isLoading: false });
  },

  // 设置数据完整性信息
  setIntegrity: (integrity: KlineIntegrity | null) => {
    set({ integrity });
  },

  // 设置自动刷新
  setAutoRefresh: (autoRefresh: boolean) => {
    set({ autoRefresh });
  },

  // 更新统计数据
  updateStats: (stats: any) => {
    set({ stats });
  },

  // 重置状态
  reset: () => {
    set(initialState);
  },
}));
