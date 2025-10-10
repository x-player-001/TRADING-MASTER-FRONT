/**
 * 信号状态管理
 * 使用Zustand管理交易信号状态
 */

import { create } from 'zustand';
import { Signal, SignalType } from '../services/signalAPI';

/**
 * 信号过滤器
 */
export interface SignalFilter {
  signalType: SignalType | 'ALL'; // 信号类型过滤
  minStrength: number; // 最小强度过滤 (0-100)
}

/**
 * 信号状态接口
 */
interface SignalState {
  // 数据状态
  signals: Signal[]; // 信号列表
  isLoading: boolean; // 加载状态
  error: string | null; // 错误信息
  lastUpdate: number | null; // 最后更新时间

  // 过滤器状态
  filter: SignalFilter;

  // Actions
  setSignals: (signals: Signal[]) => void;
  addSignal: (signal: Signal) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdate: (timestamp: number) => void;
  clearSignals: () => void;

  // 过滤器Actions
  setFilter: (filter: Partial<SignalFilter>) => void;
  resetFilter: () => void;

  // 计算属性
  getFilteredSignals: () => Signal[];
  getLatestSignal: () => Signal | null;
  getBuySignals: () => Signal[];
  getSellSignals: () => Signal[];
  getStrongSignals: () => Signal[];
}

// 默认过滤器
const DEFAULT_FILTER: SignalFilter = {
  signalType: 'ALL',
  minStrength: 0,
};

/**
 * 创建信号Store
 */
export const useSignalStore = create<SignalState>((set, get) => ({
  // 初始状态
  signals: [],
  isLoading: false,
  error: null,
  lastUpdate: null,
  filter: DEFAULT_FILTER,

  // Actions
  setSignals: (signals) =>
    set({
      signals,
      error: null,
      lastUpdate: Date.now(),
    }),

  addSignal: (signal) =>
    set((state) => {
      // 避免重复添加
      const exists = state.signals.some((s) => s.id === signal.id);
      if (exists) return state;

      return {
        signals: [signal, ...state.signals].sort(
          (a, b) => b.timestamp - a.timestamp
        ),
        lastUpdate: Date.now(),
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setLastUpdate: (timestamp) => set({ lastUpdate: timestamp }),

  clearSignals: () =>
    set({
      signals: [],
      error: null,
      lastUpdate: null,
    }),

  // 过滤器Actions
  setFilter: (filter) =>
    set((state) => ({
      filter: { ...state.filter, ...filter },
    })),

  resetFilter: () => set({ filter: DEFAULT_FILTER }),

  // 计算属性
  getFilteredSignals: () => {
    const { signals, filter } = get();
    return signals.filter((signal) => {
      // 信号类型过滤
      if (filter.signalType !== 'ALL' && signal.signal_type !== filter.signalType) {
        return false;
      }

      // 强度过滤
      if (signal.strength < filter.minStrength) {
        return false;
      }

      return true;
    });
  },

  getLatestSignal: () => {
    const { signals } = get();
    if (signals.length === 0) return null;
    return signals[0];
  },

  getBuySignals: () => {
    const { signals } = get();
    return signals.filter((s) => s.signal_type === 'BUY');
  },

  getSellSignals: () => {
    const { signals } = get();
    return signals.filter((s) => s.signal_type === 'SELL');
  },

  getStrongSignals: () => {
    const { signals } = get();
    return signals.filter((s) => s.strength > 70);
  },
}));
