/**
 * 策略创建向导的状态管理类型定义
 */

import type { CZSCPositionConfig, CZSCSignalConfig } from './strategy';

// 向导状态接口
export interface StrategyWizardState {
  // 创建模式
  creationMode: 'template' | 'scratch';
  selectedTemplate?: string;

  // 基本信息
  metadata: {
    name: string;
    description: string;
    category: string;
    version: string;
    author: string;
    tags: string[];
  };

  // Position配置列表
  positions: CZSCPositionConfig[];

  // Signal配置列表
  signals: CZSCSignalConfig[];

  // 回测参数
  backtestParams: {
    ensemble_method: 'mean' | 'vote' | 'max';
    fee_rate: number;
    digits: number;
  };
}

// 初始状态
export const initialWizardState: StrategyWizardState = {
  creationMode: 'template',
  selectedTemplate: 'bi_long',
  metadata: {
    name: '',
    description: '',
    category: 'trend',
    version: '1.0.0',
    author: '',
    tags: []
  },
  positions: [],
  signals: [],
  backtestParams: {
    ensemble_method: 'mean',
    fee_rate: 0.0002,
    digits: 2
  }
};

// 展开/折叠状态
export interface CollapseState {
  // Position展开状态 (索引集合)
  expandedPositions: Set<number>;

  // Operation展开状态 (position_index-operation_index)
  expandedOperations: Record<string, boolean>;

  // Factor展开状态 (position_index-operation_index-factor_index)
  expandedFactors: Record<string, boolean>;
}

// 信号选择器状态
export interface SignalSelectorState {
  visible: boolean;
  positionIndex: number;
  operationIndex: number;
  operationType: 'opens' | 'exits';
  factorIndex: number;
  logicType: 'signals_all' | 'signals_any' | 'signals_not';
}

// 可用信号数据结构
export interface AvailableSignal {
  name: string;
  display_name: string;
  freq: string;
  category: string;
  description?: string;
}
