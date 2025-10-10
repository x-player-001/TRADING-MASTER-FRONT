/**
 * 结构检测状态管理
 * 使用 Zustand 管理结构范围、突破信号和过滤器
 */

import { create } from 'zustand';
import {
  StructureRange,
  StructureBreakout,
  StructureStatistics,
  StructureConfig,
} from '../services/structureAPI';

// ============= 过滤器接口 =============

export interface StructureFilter {
  rangeStatus?: 'active' | 'broken' | 'expired' | 'all';
  breakoutDirection?: 'UP' | 'DOWN' | 'all';
  breakoutStatus?: 'pending' | 'hit' | 'stopped' | 'expired' | 'all';
  minConfidence?: number; // 最小置信度 0-100
  minStrength?: number;   // 最小强度 0-100
}

// ============= 状态接口 =============

interface StructureState {
  // 数据
  ranges: StructureRange[];
  breakouts: StructureBreakout[];
  statistics: StructureStatistics | null;
  config: StructureConfig | null;

  // 过滤器
  filter: StructureFilter;

  // 显示控制
  showRanges: boolean;      // 是否显示支撑/阻力线
  showBreakouts: boolean;   // 是否显示突破信号
  showStatistics: boolean;  // 是否显示统计面板

  // ============= Actions =============

  /**
   * 设置区间数据
   */
  setRanges: (ranges: StructureRange[]) => void;

  /**
   * 设置突破信号数据
   */
  setBreakouts: (breakouts: StructureBreakout[]) => void;

  /**
   * 设置统计数据
   */
  setStatistics: (statistics: StructureStatistics) => void;

  /**
   * 设置配置
   */
  setConfig: (config: StructureConfig) => void;

  /**
   * 更新过滤器
   */
  updateFilter: (filter: Partial<StructureFilter>) => void;

  /**
   * 重置过滤器
   */
  resetFilter: () => void;

  /**
   * 切换显示控制
   */
  toggleShowRanges: () => void;
  toggleShowBreakouts: () => void;
  toggleShowStatistics: () => void;

  /**
   * 获取过滤后的区间
   */
  getFilteredRanges: () => StructureRange[];

  /**
   * 获取过滤后的突破信号
   */
  getFilteredBreakouts: () => StructureBreakout[];

  /**
   * 获取活跃的区间
   */
  getActiveRanges: () => StructureRange[];

  /**
   * 获取待确认的突破信号
   */
  getPendingBreakouts: () => StructureBreakout[];

  /**
   * 清空所有数据
   */
  clearAll: () => void;
}

// ============= 默认过滤器 =============

const DEFAULT_FILTER: StructureFilter = {
  rangeStatus: 'all',
  breakoutDirection: 'all',
  breakoutStatus: 'all',
  minConfidence: 0,
  minStrength: 0,
};

// ============= Store =============

export const useStructureStore = create<StructureState>((set, get) => ({
  // 初始状态
  ranges: [],
  breakouts: [],
  statistics: null,
  config: null,
  filter: DEFAULT_FILTER,
  showRanges: true,
  showBreakouts: true,
  showStatistics: false,

  // Actions

  setRanges: (ranges) => set({ ranges }),

  setBreakouts: (breakouts) => set({ breakouts }),

  setStatistics: (statistics) => set({ statistics }),

  setConfig: (config) => set({ config }),

  updateFilter: (newFilter) =>
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    })),

  resetFilter: () => set({ filter: DEFAULT_FILTER }),

  toggleShowRanges: () => set((state) => ({ showRanges: !state.showRanges })),

  toggleShowBreakouts: () => set((state) => ({ showBreakouts: !state.showBreakouts })),

  toggleShowStatistics: () => set((state) => ({ showStatistics: !state.showStatistics })),

  getFilteredRanges: () => {
    const { ranges, filter } = get();
    return ranges.filter((range) => {
      // 状态过滤
      if (filter.rangeStatus && filter.rangeStatus !== 'all' && range.status !== filter.rangeStatus) {
        return false;
      }

      // 强度过滤
      if (filter.minStrength && range.strength < filter.minStrength) {
        return false;
      }

      return true;
    });
  },

  getFilteredBreakouts: () => {
    const { breakouts, filter } = get();
    return breakouts.filter((breakout) => {
      // 方向过滤
      if (
        filter.breakoutDirection &&
        filter.breakoutDirection !== 'all' &&
        breakout.direction !== filter.breakoutDirection
      ) {
        return false;
      }

      // 状态过滤
      if (
        filter.breakoutStatus &&
        filter.breakoutStatus !== 'all' &&
        breakout.status !== filter.breakoutStatus
      ) {
        return false;
      }

      // 置信度过滤
      if (filter.minConfidence && breakout.confidence < filter.minConfidence) {
        return false;
      }

      return true;
    });
  },

  getActiveRanges: () => {
    const { ranges } = get();
    return ranges.filter((range) => range.status === 'active');
  },

  getPendingBreakouts: () => {
    const { breakouts } = get();
    return breakouts.filter((breakout) => breakout.status === 'pending');
  },

  clearAll: () =>
    set({
      ranges: [],
      breakouts: [],
      statistics: null,
      filter: DEFAULT_FILTER,
    }),
}));

export default useStructureStore;
