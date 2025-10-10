/**
 * 量化交易 - 交易记录状态管理
 */

import { create } from 'zustand';
import { Trade, TradeStatistics } from '../types';

interface TradeState {
  // 状态
  trades: Trade[];
  statistics: TradeStatistics | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setTrades: (trades: Trade[]) => void;
  setStatistics: (statistics: TradeStatistics | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  trades: [],
  statistics: null,
  isLoading: false,
  error: null,
};

export const useTradeStore = create<TradeState>((set) => ({
  ...initialState,

  setTrades: (trades) => set({ trades }),

  setStatistics: (statistics) => set({ statistics }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
