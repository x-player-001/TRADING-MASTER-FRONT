/**
 * 策略模板配置
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
      name: '笔方向多头',
      opens: [{
        operate: 'LO',
        factors: [{
          name: '笔向上',
          signals_all: ['15m_D0BL9_V230228_向上_任意_任意_任意_0'],
          signals_any: [],
          signals_not: []
        }]
      }],
      exits: [{
        operate: 'LE',
        factors: [{
          name: '笔向下',
          signals_all: ['15m_D0BL9_V230228_向下_任意_任意_任意_0'],
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
      freq: '15m',
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
            signals_all: ['15m_D0BL9_V230228_向上_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        },
        {
          operate: 'SO',
          factors: [{
            name: '笔向下开空',
            signals_all: ['15m_D0BL9_V230228_向下_任意_任意_任意_0'],
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
            signals_all: ['15m_D0BL9_V230228_向下_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }]
        },
        {
          operate: 'SE',
          factors: [{
            name: '笔向上平空',
            signals_all: ['15m_D0BL9_V230228_向上_任意_任意_任意_0'],
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
      freq: '15m',
      bi_init_length: 9
    }]
  },

  buypoint: {
    name: '缠论买卖点',
    description: '任一买点开多，任一卖点平多',
    category: 'trend',
    icon: '🎯',
    positions_config: [{
      name: '买卖点策略',
      opens: [{
        operate: 'LO',
        factors: [
          {
            name: '一买',
            signals_all: ['15m_D1BS_一买_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          },
          {
            name: '二买',
            signals_all: ['15m_D2BS_二买_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          },
          {
            name: '三买',
            signals_all: ['15m_D3BS_三买_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }
        ]
      }],
      exits: [{
        operate: 'LE',
        factors: [
          {
            name: '一卖',
            signals_all: ['15m_D1SS_一卖_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          },
          {
            name: '二卖',
            signals_all: ['15m_D2SS_二卖_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          },
          {
            name: '三卖',
            signals_all: ['15m_D3SS_三卖_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }
        ]
      }],
      interval: 20,
      timeout: 150,
      stop_loss: 300,
      T0: false
    }],
    signals_config: [
      {
        name: 'czsc.signals.cxt.cxt_first_bs_V230228',
        freq: '15m'
      },
      {
        name: 'czsc.signals.cxt.cxt_second_bs_V230228',
        freq: '15m'
      },
      {
        name: 'czsc.signals.cxt.cxt_third_bs_V230318',
        freq: '15m'
      }
    ]
  },

  multi_factor: {
    name: '多因子组合',
    description: '笔向上 + MACD金叉 + 成交量不缩量',
    category: 'multi_factor',
    icon: '🎲',
    positions_config: [{
      name: '三重确认',
      opens: [{
        operate: 'LO',
        factors: [{
          name: '三重确认开多',
          signals_all: [
            '15m_D0BL9_V230228_向上_任意_任意_任意_0',
            '15m_MACD_金叉_任意_任意_任意_0'
          ],
          signals_any: [],
          signals_not: [
            '15m_VOL_缩量_任意_任意_任意_0'
          ]
        }]
      }],
      exits: [{
        operate: 'LE',
        factors: [
          {
            name: '笔转向',
            signals_all: ['15m_D0BL9_V230228_向下_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          },
          {
            name: 'MACD死叉',
            signals_all: ['15m_MACD_死叉_任意_任意_任意_0'],
            signals_any: [],
            signals_not: []
          }
        ]
      }],
      interval: 15,
      timeout: 80,
      stop_loss: 200,
      T0: false
    }],
    signals_config: [
      {
        name: 'czsc.signals.cxt.cxt_bi_base_V230228',
        freq: '15m'
      },
      {
        name: 'czsc.signals.bar.bar_macd_V230101',
        freq: '15m',
        fast: 12,
        slow: 26,
        signal: 9
      },
      {
        name: 'czsc.signals.vol.vol_ma_V230101',
        freq: '15m',
        timeperiod: 20
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
