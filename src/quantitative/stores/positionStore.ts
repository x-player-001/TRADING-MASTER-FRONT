/**
 * 量化交易 - 持仓状态管理
 */

import { create } from 'zustand';
import { Position, PositionStatistics } from '../types';

interface PositionState {
  // 状态
  positions: Position[];
  statistics: PositionStatistics | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPositions: (positions: Position[]) => void;
  setStatistics: (statistics: PositionStatistics | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  positions: [],
  statistics: null,
  isLoading: false,
  error: null,
};

export const usePositionStore = create<PositionState>((set) => ({
  ...initialState,

  setPositions: (positions) => set({ positions }),

  setStatistics: (statistics) => set({ statistics }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
