/**
 * 量化交易 - 策略相关类型定义（重构版）
 * 完全对接CZSC Position策略系统
 */

// ==================== CZSC Position 策略类型 ====================

/**
 * Factor 信号组合
 * 注意：后端要求三个信号字段必须存在，即使为空数组
 */
export interface CZSCFactor {
  name?: string;                    // Factor名称（可选）
  signals_all: string[];            // 所有信号必须同时满足（AND逻辑）- 必需字段
  signals_any: string[];            // 任意信号满足即可（OR逻辑）- 必需字段
  signals_not: string[];            // 不能出现的信号（NOT逻辑）- 必需字段
}

/**
 * 开仓/平仓操作
 */
export interface CZSCOperation {
  operate: 'LO' | 'LE' | 'SO' | 'SE';  // LO开多 LE平多 SO开空 SE平空
  factors: CZSCFactor[];                // 信号组合条件
}

/**
 * Position 配置
 */
export interface CZSCPositionConfig {
  name: string;                         // 仓位名称
  symbol?: string;                      // 标的代码（可选，回测时会被覆盖）
  opens: CZSCOperation[];               // 开仓操作列表
  exits: CZSCOperation[];               // 平仓操作列表
  interval?: number;                    // 开仓间隔（K线数），0表示无限制
  timeout?: number;                     // 超时平仓（K线数）
  stop_loss?: number;                   // 止损（BP），1BP=0.01%
  T0?: boolean;                         // 是否支持T+0交易
}

/**
 * 信号配置
 */
export interface CZSCSignalConfig {
  name: string;                         // 信号函数名
  freq: string;                         // 周期（如15m、1h）
  [key: string]: any;                   // 其他信号参数（如bi_init_length等）
}

/**
 * 创建策略请求
 */
export interface CZSCStrategyCreate {
  strategy_id: string;                  // 策略唯一标识
  name: string;                         // 策略名称
  description?: string;                 // 策略描述
  category?: string;                    // 策略分类（trend/reversal/arbitrage等）
  positions_config: CZSCPositionConfig[]; // Position配置列表
  signals_config: CZSCSignalConfig[];   // 信号配置列表
  ensemble_method?: 'mean' | 'vote';    // 集成方法（默认mean）
  fee_rate?: number;                    // 手续费率（默认0.0002）
  version?: string;                     // 版本号
  author?: string;                      // 作者
  tags?: string[];                      // 标签
}

/**
 * 更新策略请求
 */
export interface CZSCStrategyUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
  positions_config?: CZSCPositionConfig[];
  signals_config?: CZSCSignalConfig[];
  ensemble_method?: 'mean' | 'vote';
  fee_rate?: number;
  tags?: string[];
}

/**
 * 策略详情
 */
export interface CZSCStrategy {
  strategy_id: string;
  name: string;
  description?: string;
  category?: string;
  positions_config: CZSCPositionConfig[];
  signals_config: CZSCSignalConfig[];
  ensemble_method?: string;
  fee_rate?: number;
  version?: string;
  author?: string;
  tags?: string[];
  use_count: number;                    // 使用次数
  avg_return: number;                   // 平均收益率
  avg_sharpe: number;                   // 平均夏普比
  is_active: boolean;                   // 是否活跃
  created_at: string;
  updated_at: string;
}

/**
 * 策略列表项
 */
export interface CZSCStrategyListItem {
  strategy_id: string;
  name: string;
  category?: string;
  version?: string;
  author?: string;
  use_count: number;
  avg_return: number;
  avg_sharpe: number;
  is_active: boolean;
  created_at: string;
}

/**
 * 策略列表响应
 */
export interface CZSCStrategyListResponse {
  total: number;
  strategies: CZSCStrategyListItem[];
}
