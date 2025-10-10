/**
 * 量化交易 - 回测状态管理
 */

import { create } from 'zustand';
import { BacktestResult, Trade } from '../types';

interface BacktestState {
  // 状态
  backtests: BacktestResult[];
  selectedBacktest: BacktestResult | null;
  backtestTrades: Trade[];
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setBacktests: (backtests: BacktestResult[]) => void;
  addBacktest: (backtest: BacktestResult) => void;
  removeBacktest: (id: number) => void;
  selectBacktest: (backtest: BacktestResult | null) => void;
  setBacktestTrades: (trades: Trade[]) => void;
  setRunning: (running: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  backtests: [],
  selectedBacktest: null,
  backtestTrades: [],
  isRunning: false,
  isLoading: false,
  error: null,
};

export const useBacktestStore = create<BacktestState>((set) => ({
  ...initialState,

  setBacktests: (backtests) => set({ backtests }),

  addBacktest: (backtest) =>
    set((state) => ({
      backtests: [backtest, ...state.backtests],
    })),

  removeBacktest: (id) =>
    set((state) => ({
      backtests: state.backtests.filter((b) => b.id !== id),
      selectedBacktest:
        state.selectedBacktest?.id === id ? null : state.selectedBacktest,
    })),

  selectBacktest: (backtest) => set({ selectedBacktest: backtest }),

  setBacktestTrades: (trades) => set({ backtestTrades: trades }),

  setRunning: (running) => set({ isRunning: running }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
