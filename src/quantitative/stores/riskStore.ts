/**
 * 量化交易 - 风险管理状态管理
 */

import { create } from 'zustand';
import { RiskConfig, RiskExposure, RiskCheckResult } from '../types';

interface RiskState {
  // 状态
  config: RiskConfig | null;
  exposure: RiskExposure | null;
  checkResult: RiskCheckResult | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setConfig: (config: RiskConfig | null) => void;
  setExposure: (exposure: RiskExposure | null) => void;
  setCheckResult: (result: RiskCheckResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  config: null,
  exposure: null,
  checkResult: null,
  isLoading: false,
  error: null,
};

export const useRiskStore = create<RiskState>((set) => ({
  ...initialState,

  setConfig: (config) => set({ config }),

  setExposure: (exposure) => set({ exposure }),

  setCheckResult: (result) => set({ checkResult: result }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
