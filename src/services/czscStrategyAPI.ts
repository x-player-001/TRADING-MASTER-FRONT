/**
 * CZSC回测系统 - 策略管理接口
 * Base URL: http://localhost:8000
 */

import { czscApiGet, czscApiPost, czscApiPut, czscApiDelete } from './czscApiClient';

// ============= 类型定义 =============

/**
 * 策略信号配置
 */
export interface StrategySignal {
  name: string;                    // 信号函数名
  freq: string;                    // 周期
}

/**
 * 策略条件类型
 */
export type ConditionType = 'signal_match' | 'stop_loss' | 'take_profit' | 'holding_bars';

/**
 * 策略条件
 */
export interface StrategyCondition {
  type: ConditionType;
  signal_pattern?: string;         // 信号模式（signal_match类型）
  value?: number;                  // 数值（stop_loss/take_profit/holding_bars类型）
  description?: string;            // 条件描述
}

/**
 * 策略规则
 */
export interface StrategyRules {
  operator: 'AND' | 'OR';          // 条件组合方式
  conditions: StrategyCondition[];
}

/**
 * 仓位管理配置
 */
export interface PositionSizing {
  type: 'fixed' | 'percentage' | 'kelly';
  value: number;                   // 固定仓位（1.0=满仓）
  description?: string;
}

/**
 * 风控设置
 */
export interface RiskManagement {
  max_position?: number;           // 最大仓位
  max_loss_per_trade?: number;     // 单笔最大亏损
  max_daily_loss?: number;         // 日内最大亏损
}

/**
 * 策略配置
 */
export interface StrategyConfig {
  strategy_id: string;             // 策略唯一标识
  name: string;                    // 策略名称
  description?: string;            // 策略描述
  author?: string;                 // 作者
  version?: string;                // 版本号
  is_active?: boolean;             // 是否启用
  signals: StrategySignal[];       // 使用的信号列表
  entry_rules: StrategyRules;      // 入场规则
  exit_rules: StrategyRules;       // 出场规则
  position_sizing?: PositionSizing; // 仓位管理
  risk_management?: RiskManagement; // 风控设置
}

/**
 * 策略详情（含时间戳）
 */
export interface Strategy extends StrategyConfig {
  created_at: string;
  updated_at: string;
}

/**
 * 策略列表项
 */
export interface StrategyListItem {
  strategy_id: string;
  name: string;
  description?: string;
  author?: string;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 策略列表响应
 */
export interface StrategyListResponse {
  total: number;
  strategies: StrategyListItem[];
  limit: number;
  offset: number;
}

/**
 * 策略回测历史项
 */
export interface StrategyBacktestHistory {
  backtest_task_id: string;
  backtest_time: string;
  total_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  trades_count: number;
}

/**
 * 策略回测历史响应
 */
export interface StrategyBacktestHistoryResponse {
  strategy_id: string;
  total: number;
  backtests: StrategyBacktestHistory[];
}

/**
 * 策略模板
 */
export interface StrategyTemplate {
  template_id: string;
  name: string;
  category: string;                // 类别：趋势跟踪/组合策略/风险管理
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  config_template: Omit<StrategyConfig, 'strategy_id' | 'name' | 'author'>;
  created_at: string;
}

/**
 * 模板列表响应
 */
export interface TemplateListResponse {
  total: number;
  templates: StrategyTemplate[];
}

/**
 * 从模板创建策略请求
 */
export interface CreateFromTemplateRequest {
  template_id: string;
  strategy_id: string;
  name: string;
  author?: string;
}

/**
 * 操作响应
 */
export interface OperationResponse {
  success: boolean;
  strategy_id: string;
  message: string;
}

// ============= API服务类 =============

class CZSCStrategyAPI {
  /**
   * 创建策略
   * POST /api/v1/strategy
   */
  async createStrategy(config: StrategyConfig): Promise<OperationResponse> {
    return czscApiPost<OperationResponse>('/api/v1/strategy', config);
  }

  /**
   * 从模板创建策略
   * POST /api/v1/strategy/from_template
   */
  async createFromTemplate(request: CreateFromTemplateRequest): Promise<OperationResponse> {
    return czscApiPost<OperationResponse>('/api/v1/strategy/from_template', request);
  }

  /**
   * 获取策略列表
   * GET /api/v1/strategy/list
   */
  async getStrategyList(params?: {
    limit?: number;
    offset?: number;
    author?: string;
    is_active?: boolean;
  }): Promise<StrategyListResponse> {
    return czscApiGet<StrategyListResponse>('/api/v1/strategy/list', { params });
  }

  /**
   * 获取策略详情
   * GET /api/v1/strategy/{strategy_id}
   */
  async getStrategy(strategyId: string): Promise<Strategy> {
    return czscApiGet<Strategy>(`/api/v1/strategy/${strategyId}`);
  }

  /**
   * 更新策略
   * PUT /api/v1/strategy/{strategy_id}
   */
  async updateStrategy(
    strategyId: string,
    updates: Partial<StrategyConfig>
  ): Promise<OperationResponse> {
    return czscApiPut<OperationResponse>(`/api/v1/strategy/${strategyId}`, updates);
  }

  /**
   * 删除策略
   * DELETE /api/v1/strategy/{strategy_id}
   */
  async deleteStrategy(strategyId: string): Promise<OperationResponse> {
    return czscApiDelete<OperationResponse>(`/api/v1/strategy/${strategyId}`);
  }

  /**
   * 获取策略回测历史
   * GET /api/v1/strategy/{strategy_id}/backtests
   */
  async getStrategyBacktests(
    strategyId: string,
    limit?: number
  ): Promise<StrategyBacktestHistoryResponse> {
    return czscApiGet<StrategyBacktestHistoryResponse>(
      `/api/v1/strategy/${strategyId}/backtests`,
      { params: { limit } }
    );
  }

  /**
   * 获取策略模板列表
   * GET /api/v1/strategy/template/list
   */
  async getTemplateList(params?: {
    category?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  }): Promise<TemplateListResponse> {
    return czscApiGet<TemplateListResponse>('/api/v1/strategy/template/list', { params });
  }

  /**
   * 获取模板详情
   * GET /api/v1/strategy/template/{template_id}
   */
  async getTemplate(templateId: string): Promise<StrategyTemplate> {
    return czscApiGet<StrategyTemplate>(`/api/v1/strategy/template/${templateId}`);
  }
}

// 导出单例
export const czscStrategyAPI = new CZSCStrategyAPI();
export default czscStrategyAPI;
