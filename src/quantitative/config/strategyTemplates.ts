/**
 * 策略模板配置
 *
 * 根据 VERIFIED_STRATEGY_CONFIGS.md 验证后的配置
 * 最后验证日期: 2025-10-15
 */

import type { CZSCPositionConfig, CZSCSignalConfig } from '../types/strategy';

export interface StrategyTemplate {
  name: string;
  description: string;
  category: string;
  icon: string;
  positions_config: CZSCPositionConfig[];
  signals_config: CZSCSignalConfig[];
}

export const strategyTemplates: Record<string, StrategyTemplate> = {
  bi_long: {
    name: '笔方向纯多头',
    description: '笔向上开多，笔向下平多',
    category: 'trend',
    icon: '📈',
    positions_config: [{
      name: '笔方向策略',
      opens: [{
        operate: 'LO',
        factors: [{
          name: '笔向上',
          signals_all: ['15分钟_D0BL9_V230228_向上_任意_任意_0'],
          signals_any: [],
          signals_not: []
        }]
      }],
      exits: [{
        operate: 'LE',
        factors: [{
          name: '笔向下',
          signals_all: ['15分钟_D0BL9_V230228_向下_任意_任意_0'],
          signals_any: [],
          signals_not: []
        }]
      }],
      interval: 10,
      timeout: 100,
      stop_loss: 200,
      T0: false
    }],
    signals_config: [{
      name: 'czsc.signals.cxt.cxt_bi_base_V230228',
      freq: '15分钟',
      bi_init_length: 9
    }]
  },

  bi_bidirection: {
    name: '笔方向多空双向',
    description: '笔向上做多，笔向下做空',
    category: 'trend',
    icon: '🔄',
    positions_config: [{
      name: '笔方向双向',
      opens: [
        {
          operate: 'LO',
          factors: [{
            name: '笔向上开多',
            signals_all: ['15分钟_D0BL9_V230228_向上_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        },
        {
          operate: 'SO',
          factors: [{
            name: '笔向下开空',
            signals_all: ['15分钟_D0BL9_V230228_向下_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        }
      ],
      exits: [
        {
          operate: 'LE',
          factors: [{
            name: '笔向下平多',
            signals_all: ['15分钟_D0BL9_V230228_向下_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        },
        {
          operate: 'SE',
          factors: [{
            name: '笔向上平空',
            signals_all: ['15分钟_D0BL9_V230228_向上_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        }
      ],
      interval: 5,
      timeout: 100,
      stop_loss: 200,
      T0: false
    }],
    signals_config: [{
      name: 'czsc.signals.cxt.cxt_bi_base_V230228',
      freq: '15分钟',
      bi_init_length: 9
    }]
  },

  buypoint: {
    name: '缠论买卖点',
    description: '一买/二买/三买开多，笔向下退出',
    category: 'trend',
    icon: '🎯',
    positions_config: [{
      name: '买卖点策略',
      opens: [
        {
          operate: 'LO',
          factors: [{
            name: '一买出现',
            signals_all: ['15分钟_D1B_BUY1_一买_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        },
        {
          operate: 'LO',
          factors: [{
            name: '二买出现',
            signals_all: ['15分钟_D1#SMA#21_BS2辅助V230320_二买_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        },
        {
          operate: 'LO',
          factors: [{
            name: '三买出现',
            signals_all: ['15分钟_D1#SMA#34_BS3辅助V230319_三买_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        }
      ],
      exits: [{
        operate: 'LE',
        factors: [{
          name: '向下笔退出',
          signals_all: ['15分钟_D0BL9_V230228_向下_任意_任意_0'],
          signals_any: [],
          signals_not: []
        }]
      }],
      interval: 10,
      timeout: 100,
      stop_loss: 200,
      T0: false
    }],
    signals_config: [
      {
        name: 'czsc.signals.cxt.cxt_first_buy_V221126',
        freq: '15分钟',
        di: 1
      },
      {
        name: 'czsc.signals.cxt.cxt_second_bs_V230320',
        freq: '15分钟',
        di: 1
      },
      {
        name: 'czsc.signals.cxt.cxt_third_bs_V230319',
        freq: '15分钟',
        di: 1
      },
      {
        name: 'czsc.signals.cxt.cxt_bi_base_V230228',
        freq: '15分钟',
        bi_init_length: 9
      }
    ]
  },

  multi_factor: {
    name: '多因子组合',
    description: '一买或二买开仓，笔向下退出',
    category: 'multi_factor',
    icon: '🎲',
    positions_config: [{
      name: '多因子组合',
      opens: [
        {
          operate: 'LO',
          factors: [{
            name: '一买因子',
            signals_all: ['15分钟_D1B_BUY1_一买_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        },
        {
          operate: 'LO',
          factors: [{
            name: '二买因子',
            signals_all: ['15分钟_D1#SMA#21_BS2辅助V230320_二买_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        }
      ],
      exits: [{
        operate: 'LE',
        factors: [{
          name: '向下笔',
          signals_all: ['15分钟_D0BL9_V230228_向下_任意_任意_0'],
          signals_any: [],
          signals_not: []
        }]
      }],
      interval: 10,
      timeout: 100,
      stop_loss: 200,
      T0: false
    }],
    signals_config: [
      {
        name: 'czsc.signals.cxt.cxt_first_buy_V221126',
        freq: '15分钟',
        di: 1
      },
      {
        name: 'czsc.signals.cxt.cxt_second_bs_V230320',
        freq: '15分钟',
        di: 1
      },
      {
        name: 'czsc.signals.cxt.cxt_bi_base_V230228',
        freq: '15分钟',
        bi_init_length: 9
      }
    ]
  },

  scratch: {
    name: '空白策略',
    description: '从零开始配置所有参数',
    category: 'custom',
    icon: '🎨',
    positions_config: [],
    signals_config: []
  }
};
