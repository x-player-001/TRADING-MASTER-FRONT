/**
 * 量化交易 - 策略管理API
 *
 * ⚠️ 重要：已迁移到CZSC回测系统
 * Base URL: http://localhost:8000/api/v1/strategy
 */

import { czscApiGet, czscApiPost, czscApiPut, czscApiDelete } from '../../services/czscApiClient';
import {
  StrategyConfig,
  StrategyPerformance,
  ToggleStrategyRequest,
  CZSCStrategy,
  CZSCStrategyListResponse,
  CZSCStrategyBacktestHistory
} from '../types';

/**
 * 将旧版策略配置转换为CZSC格式
 */
const convertToCSCStrategy = (oldStrategy: Partial<StrategyConfig>): any => {
  // 根据旧版策略类型生成CZSC信号配置
  const signalMapping: Record<string, string[]> = {
    'breakout': ['cxt_third_bs_V230318'],
    'trend_following': ['tas_first_bs_V230217', 'tas_macd_bs1_V230312'],
    'grid': ['cxt_second_bs_V230320'],
    'custom': ['cxt_third_bs_V230318']
  };

  const signals = signalMapping[oldStrategy.type || 'custom'] || ['cxt_third_bs_V230318'];

  return {
    strategy_id: oldStrategy.id?.toString() || `strategy_${Date.now()}`,
    name: oldStrategy.name,
    description: oldStrategy.description || '',
    is_active: oldStrategy.enabled,
    signals: signals.map(name => ({
      name,
      freq: '15分钟'
    })),
    entry_rules: {
      operator: 'OR',
      conditions: [
        {
          type: 'signal_match',
          signal_pattern: '*买*',
          description: '检测到买入信号'
        }
      ]
    },
    exit_rules: {
      operator: 'OR',
      conditions: [
        {
          type: 'signal_match',
          signal_pattern: '*卖*',
          description: '检测到卖出信号'
        },
        {
          type: 'stop_loss',
          value: -0.03,
          description: '止损3%'
        }
      ]
    },
    position_sizing: {
      type: 'fixed',
      value: 1.0
    }
  };
};

/**
 * 将字符串转换为数字ID（简单哈希）
 */
const stringToNumberId = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * ID映射表：数字ID → 字符串strategy_id
 * 用于在需要调用后端API时反向查找
 */
const idMap = new Map<number, string>();

/**
 * 将CZSC策略转换为旧版格式
 */
const convertFromCZSCStrategy = (czscStrategy: CZSCStrategy): StrategyConfig => {
  const numericId = stringToNumberId(czscStrategy.strategy_id);

  // 保存映射关系
  idMap.set(numericId, czscStrategy.strategy_id);

  return {
    id: numericId,
    name: czscStrategy.name,
    type: 'custom', // CZSC没有固定类型，统一为custom
    description: czscStrategy.description || '',
    parameters: {
      signals: czscStrategy.signals,
      entry_rules: czscStrategy.entry_rules,
      exit_rules: czscStrategy.exit_rules,
      // 保存原始strategy_id，方便后续使用
      _originalStrategyId: czscStrategy.strategy_id
    },
    enabled: czscStrategy.is_active,
    mode: 'backtest',
    created_at: czscStrategy.created_at,
    updated_at: czscStrategy.updated_at
  };
};

/**
 * 根据数字ID获取原始strategy_id
 */
const getOriginalStrategyId = (id: number): string => {
  const originalId = idMap.get(id);
  if (!originalId) {
    throw new Error(`无法找到ID ${id} 对应的strategy_id，请先调用getStrategies()`);
  }
  return originalId;
};

export const strategyAPI = {
  /**
   * 获取所有策略
   * GET /api/v1/strategy/list
   */
  getStrategies: async (): Promise<StrategyConfig[]> => {
    const response = await czscApiGet<CZSCStrategyListResponse>('/api/v1/strategy/list', {
      params: { limit: 100 }
    });
    return response.strategies.map(convertFromCZSCStrategy);
  },

  /**
   * 获取策略详情
   * GET /api/v1/strategy/{strategy_id}
   */
  getStrategy: async (id: number): Promise<StrategyConfig> => {
    const strategyId = getOriginalStrategyId(id);
    const czscStrategy = await czscApiGet<CZSCStrategy>(`/api/v1/strategy/${strategyId}`);
    return convertFromCZSCStrategy(czscStrategy);
  },

  /**
   * 创建策略
   * POST /api/v1/strategy
   */
  createStrategy: async (data: Partial<StrategyConfig>): Promise<StrategyConfig> => {
    const czscData = convertToCSCStrategy(data);
    const response = await czscApiPost<{ success: boolean; strategy_id: string; message: string }>(
      '/api/v1/strategy',
      czscData
    );

    // 创建成功后，重新获取策略详情
    if (response.success) {
      const created = await czscApiGet<CZSCStrategy>(`/api/v1/strategy/${response.strategy_id}`);
      return convertFromCZSCStrategy(created);
    }

    throw new Error(response.message || '创建策略失败');
  },

  /**
   * 更新策略
   * PUT /api/v1/strategy/{strategy_id}
   */
  updateStrategy: async (id: number, data: Partial<StrategyConfig>): Promise<StrategyConfig> => {
    const strategyId = getOriginalStrategyId(id);

    // 构建更新数据（只更新改变的字段）
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.enabled !== undefined) updateData.is_active = data.enabled;

    const response = await czscApiPut<{ success: boolean; strategy_id: string; message: string }>(
      `/api/v1/strategy/${strategyId}`,
      updateData
    );

    if (response.success) {
      const updated = await czscApiGet<CZSCStrategy>(`/api/v1/strategy/${strategyId}`);
      return convertFromCZSCStrategy(updated);
    }

    throw new Error(response.message || '更新策略失败');
  },

  /**
   * 删除策略
   * DELETE /api/v1/strategy/{strategy_id}
   */
  deleteStrategy: async (id: number): Promise<void> => {
    const strategyId = getOriginalStrategyId(id);
    const response = await czscApiDelete<{ success: boolean; message: string }>(
      `/api/v1/strategy/${strategyId}`
    );

    if (!response.success) {
      throw new Error(response.message || '删除策略失败');
    }

    // 删除成功后，从映射表中移除
    idMap.delete(id);
  },

  /**
   * 启用/禁用策略
   * PUT /api/v1/strategy/{strategy_id}
   */
  toggleStrategy: async (id: number, enabled: boolean): Promise<{ success: boolean; message: string }> => {
    const strategyId = getOriginalStrategyId(id);
    const response = await czscApiPut<{ success: boolean; strategy_id: string; message: string }>(
      `/api/v1/strategy/${strategyId}`,
      { is_active: enabled }
    );

    return {
      success: response.success,
      message: response.message
    };
  },

  /**
   * 获取策略性能统计（从回测历史计算）
   * GET /api/v1/strategy/{strategy_id}/backtests
   */
  getPerformance: async (id: number): Promise<StrategyPerformance> => {
    const strategyId = getOriginalStrategyId(id);

    try {
      const response = await czscApiGet<CZSCStrategyBacktestHistory>(
        `/api/v1/strategy/${strategyId}/backtests`,
        { params: { limit: 10 } }
      );

      // 从回测历史计算性能统计
      const backtests = response.backtests || [];

      if (backtests.length === 0) {
        return {
          strategy_id: id,
          total_backtests: 0,
          total_trades: 0,
          win_trades: 0,
          loss_trades: 0,
          win_rate: 0,
          avg_return: 0,
          avg_sharpe: 0,
          avg_max_drawdown: 0
        };
      }

      const totalTrades = backtests.reduce((sum, bt) => sum + bt.trades_count, 0);
      const avgReturn = backtests.reduce((sum, bt) => sum + bt.total_return, 0) / backtests.length;
      const avgSharpe = backtests.reduce((sum, bt) => sum + bt.sharpe_ratio, 0) / backtests.length;
      const avgMaxDrawdown = backtests.reduce((sum, bt) => sum + bt.max_drawdown, 0) / backtests.length;

      return {
        strategy_id: id,
        total_backtests: backtests.length,
        total_trades: totalTrades,
        win_trades: 0, // CZSC API未提供
        loss_trades: 0, // CZSC API未提供
        win_rate: 0, // 需要从详细数据计算
        avg_return: avgReturn,
        avg_sharpe: avgSharpe,
        avg_max_drawdown: avgMaxDrawdown
      };
    } catch (error) {
      console.error('获取策略性能失败:', error);
      return {
        strategy_id: id,
        total_backtests: 0,
        total_trades: 0,
        win_trades: 0,
        loss_trades: 0,
        win_rate: 0,
        avg_return: 0,
        avg_sharpe: 0,
        avg_max_drawdown: 0
      };
    }
  },

  /**
   * 从模板创建策略
   * POST /api/v1/strategy/from_template
   */
  createFromTemplate: async (templateId: string, name: string, author?: string): Promise<StrategyConfig> => {
    const response = await czscApiPost<{ success: boolean; strategy_id: string; message: string }>(
      '/api/v1/strategy/from_template',
      {
        template_id: templateId,
        strategy_id: `strategy_${Date.now()}`,
        name,
        author
      }
    );

    if (response.success) {
      const created = await czscApiGet<CZSCStrategy>(`/api/v1/strategy/${response.strategy_id}`);
      return convertFromCZSCStrategy(created);
    }

    throw new Error(response.message || '从模板创建策略失败');
  },

  /**
   * 获取策略模板列表
   * GET /api/v1/strategy/template/list
   */
  getTemplates: async () => {
    return czscApiGet('/api/v1/strategy/template/list');
  }
};
