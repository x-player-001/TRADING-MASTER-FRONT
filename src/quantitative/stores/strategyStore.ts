/**
 * 量化交易 - 策略状态管理
 */

import { create } from 'zustand';
import { StrategyConfig, StrategyPerformance } from '../types';

interface StrategyState {
  // 状态
  strategies: StrategyConfig[];
  selectedStrategy: StrategyConfig | null;
  performance: StrategyPerformance | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setStrategies: (strategies: StrategyConfig[]) => void;
  addStrategy: (strategy: StrategyConfig) => void;
  updateStrategy: (id: number, updates: Partial<StrategyConfig>) => void;
  removeStrategy: (id: number) => void;
  selectStrategy: (strategy: StrategyConfig | null) => void;
  setPerformance: (performance: StrategyPerformance | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  strategies: [],
  selectedStrategy: null,
  performance: null,
  isLoading: false,
  error: null,
};

export const useStrategyStore = create<StrategyState>((set) => ({
  ...initialState,

  setStrategies: (strategies) => set({ strategies }),

  addStrategy: (strategy) =>
    set((state) => ({
      strategies: [...state.strategies, strategy],
    })),

  updateStrategy: (id, updates) =>
    set((state) => ({
      strategies: state.strategies.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
      selectedStrategy:
        state.selectedStrategy?.id === id
          ? { ...state.selectedStrategy, ...updates }
          : state.selectedStrategy,
    })),

  removeStrategy: (id) =>
    set((state) => ({
      strategies: state.strategies.filter((s) => s.id !== id),
      selectedStrategy:
        state.selectedStrategy?.id === id ? null : state.selectedStrategy,
    })),

  selectStrategy: (strategy) => set({ selectedStrategy: strategy }),

  setPerformance: (performance) => set({ performance }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
