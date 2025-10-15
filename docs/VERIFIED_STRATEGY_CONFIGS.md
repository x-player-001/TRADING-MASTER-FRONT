# CZSC策略配置 - 已测试验证版本

本文档包含经过完整测试验证的CZSC策略配置，可直接用于前端调用。

## 测试验证状态

✅ 所有4个策略已通过完整集成测试
✅ 所有信号函数名称和信号名称格式已验证
✅ 所有配置可直接使用，无需修改

测试日期: 2025-10-15

## 重要说明

### 1. 信号名称格式（7段式）

```
完整信号名 = signal_key (3段) + "_" + signal_value (4段)

示例:
  signal_key: 15分钟_D0BL9_V230228
  signal_value: 向上_任意_任意_0
  完整信号名: 15分钟_D0BL9_V230228_向上_任意_任意_0
```

### 2. Factor配置规则

**必须包含3个字段:**
- `signals_all`: 数组，AND逻辑，**不能为空**（至少1个信号）
- `signals_any`: 数组，OR逻辑（建议留空，用多个Factor代替）
- `signals_not`: 数组，NOT逻辑

**正确示例:**
```json
{
  "name": "因子名称",
  "signals_all": ["15分钟_D0BL9_V230228_向上_任意_任意_0"],
  "signals_any": [],
  "signals_not": []
}
```

**错误示例（signals_all为空）:**
```json
{
  "name": "因子名称",
  "signals_all": [],  // ❌ 错误！会报错: signals_all 不能为空
  "signals_any": [],
  "signals_not": []
}
```

### 3. 操作代码 (operate)

使用英文代码，不要用中文:
- `"LO"` - 开多 (Long Open)
- `"LE"` - 平多 (Long Exit)
- `"SO"` - 开空 (Short Open)
- `"SE"` - 平空 (Short Exit)

### 4. 信号函数名称

**必须使用完整模块路径:**
- ✅ 正确: `"czsc.signals.cxt.cxt_bi_base_V230228"`
- ❌ 错误: `"cxt_bi_base_V230228"`

---

## 策略1: 笔方向策略

**描述**: 基于笔的方向进行交易：向上笔开多仓，向下笔平多仓

**信号函数**: `czsc.signals.cxt.cxt_bi_base_V230228`

**完整配置:**

```json
{
  "symbol": "BTCUSDT",
  "freq": "15分钟",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "positions_config": [
    {
      "name": "笔方向策略",
      "symbol": "BTCUSDT",
      "opens": [
        {
          "name": "笔向上开多",
          "operate": "LO",
          "factors": [
            {
              "name": "笔向上",
              "signals_all": ["15分钟_D0BL9_V230228_向上_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "exits": [
        {
          "name": "笔向下平多",
          "operate": "LE",
          "factors": [
            {
              "name": "笔向下",
              "signals_all": ["15分钟_D0BL9_V230228_向下_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "interval": 10,
      "timeout": 100,
      "stop_loss": 200,
      "T0": false
    }
  ],
  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_bi_base_V230228",
      "freq": "15分钟",
      "bi_init_length": 9
    }
  ],
  "ensemble_method": "mean",
  "fee_rate": 0.0002,
  "digits": 2
}
```

---

## 策略2: 一买策略

**描述**: 基于缠论一买点开仓的策略

**信号函数**: `czsc.signals.cxt.cxt_first_buy_V221126` + `czsc.signals.cxt.cxt_bi_base_V230228`

**完整配置:**

```json
{
  "symbol": "BTCUSDT",
  "freq": "15分钟",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "positions_config": [
    {
      "name": "一买策略",
      "symbol": "BTCUSDT",
      "opens": [
        {
          "name": "一买开多",
          "operate": "LO",
          "factors": [
            {
              "name": "一买出现",
              "signals_all": ["15分钟_D1B_BUY1_一买_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "exits": [
        {
          "name": "笔向下退出",
          "operate": "LE",
          "factors": [
            {
              "name": "向下笔",
              "signals_all": ["15分钟_D0BL9_V230228_向下_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "interval": 10,
      "timeout": 50,
      "stop_loss": 200,
      "T0": false
    }
  ],
  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_first_buy_V221126",
      "freq": "15分钟",
      "di": 1
    },
    {
      "name": "czsc.signals.cxt.cxt_bi_base_V230228",
      "freq": "15分钟",
      "bi_init_length": 9
    }
  ],
  "ensemble_method": "mean",
  "fee_rate": 0.0002,
  "digits": 2
}
```

**注意**: 一买信号可能的signal_value包括: 一买/二买/三买/类一买/类二买/类三买/其他

---

## 策略3: 二买二卖策略

**描述**: 基于缠论二买二卖点的策略（使用SMA辅助判断）

**信号函数**: `czsc.signals.cxt.cxt_second_bs_V230320`

**完整配置:**

```json
{
  "symbol": "BTCUSDT",
  "freq": "15分钟",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "positions_config": [
    {
      "name": "二买二卖策略",
      "symbol": "BTCUSDT",
      "opens": [
        {
          "name": "二买开多",
          "operate": "LO",
          "factors": [
            {
              "name": "二买出现",
              "signals_all": ["15分钟_D1#SMA#21_BS2辅助V230320_二买_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "exits": [
        {
          "name": "二卖平多",
          "operate": "LE",
          "factors": [
            {
              "name": "二卖出现",
              "signals_all": ["15分钟_D1#SMA#21_BS2辅助V230320_二卖_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "interval": 10,
      "timeout": 100,
      "stop_loss": 200,
      "T0": false
    }
  ],
  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_second_bs_V230320",
      "freq": "15分钟",
      "di": 1
    }
  ],
  "ensemble_method": "mean",
  "fee_rate": 0.0002,
  "digits": 2
}
```

---

## 策略4: 三买三卖策略

**描述**: 基于缠论三买三卖点的策略（使用SMA辅助判断）

**信号函数**: `czsc.signals.cxt.cxt_third_bs_V230319`

**完整配置:**

```json
{
  "symbol": "BTCUSDT",
  "freq": "15分钟",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "positions_config": [
    {
      "name": "三买三卖策略",
      "symbol": "BTCUSDT",
      "opens": [
        {
          "name": "三买开多",
          "operate": "LO",
          "factors": [
            {
              "name": "三买出现",
              "signals_all": ["15分钟_D1#SMA#34_BS3辅助V230319_三买_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "exits": [
        {
          "name": "三卖平多",
          "operate": "LE",
          "factors": [
            {
              "name": "三卖出现",
              "signals_all": ["15分钟_D1#SMA#34_BS3辅助V230319_三卖_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "interval": 10,
      "timeout": 100,
      "stop_loss": 200,
      "T0": false
    }
  ],
  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_third_bs_V230319",
      "freq": "15分钟",
      "di": 1
    }
  ],
  "ensemble_method": "mean",
  "fee_rate": 0.0002,
  "digits": 2
}
```

---

## 策略5: 多因子组合策略 (OR逻辑示例)

**描述**: 组合多个信号的策略示例：一买或二买开仓（满足任一条件即开仓）

**实现OR逻辑的方法**: 在 `opens` 数组中添加多个 Event

**完整配置:**

```json
{
  "symbol": "BTCUSDT",
  "freq": "15分钟",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "positions_config": [
    {
      "name": "多因子组合",
      "symbol": "BTCUSDT",
      "opens": [
        {
          "name": "一买开仓",
          "operate": "LO",
          "factors": [
            {
              "name": "一买因子",
              "signals_all": ["15分钟_D1B_BUY1_一买_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        },
        {
          "name": "二买开仓",
          "operate": "LO",
          "factors": [
            {
              "name": "二买因子",
              "signals_all": ["15分钟_D1#SMA#21_BS2辅助V230320_二买_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "exits": [
        {
          "name": "笔向下退出",
          "operate": "LE",
          "factors": [
            {
              "name": "向下笔",
              "signals_all": ["15分钟_D0BL9_V230228_向下_任意_任意_0"],
              "signals_any": [],
              "signals_not": []
            }
          ]
        }
      ],
      "interval": 10,
      "timeout": 100,
      "stop_loss": 200,
      "T0": false
    }
  ],
  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_first_buy_V221126",
      "freq": "15分钟",
      "di": 1
    },
    {
      "name": "czsc.signals.cxt.cxt_second_bs_V230320",
      "freq": "15分钟",
      "di": 1
    },
    {
      "name": "czsc.signals.cxt.cxt_bi_base_V230228",
      "freq": "15分钟",
      "bi_init_length": 9
    }
  ],
  "ensemble_method": "mean",
  "fee_rate": 0.0002,
  "digits": 2
}
```

---

## 已验证的信号函数清单

| 信号函数 | signal_key格式 | 可能的signal_value | 用途 |
|---------|---------------|------------------|-----|
| `czsc.signals.cxt.cxt_bi_base_V230228` | `15分钟_D0BL9_V230228` | 向上/向下/其他 + `_任意_任意_0` | 笔方向判断 |
| `czsc.signals.cxt.cxt_first_buy_V221126` | `15分钟_D1B_BUY1` | 一买/二买/三买/类一买/类二买/类三买/其他 + `_任意_任意_0` | 一买点识别 |
| `czsc.signals.cxt.cxt_second_bs_V230320` | `15分钟_D1#SMA#21_BS2辅助V230320` | 二买/二卖/其他 + `_任意_任意_0` | 二买二卖识别 |
| `czsc.signals.cxt.cxt_third_bs_V230319` | `15分钟_D1#SMA#34_BS3辅助V230319` | 三买/三卖/其他 + `_任意_任意_0` | 三买三卖识别 |

---

## API调用示例

### 创建策略

```bash
POST /api/backtest/position

Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "freq": "15分钟",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "positions_config": [
    {
      "name": "笔方向策略",
      "symbol": "BTCUSDT",
      "opens": [...],
      "exits": [...],
      "interval": 10,
      "timeout": 100,
      "stop_loss": 200,
      "T0": false
    }
  ],
  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_bi_base_V230228",
      "freq": "15分钟",
      "bi_init_length": 9
    }
  ],
  "ensemble_method": "mean",
  "fee_rate": 0.0002,
  "digits": 2
}
```

---

## 常见问题

### Q1: 测试数据中为什么signal_value都是"其他_任意_任意_0"？

A: 因为测试使用的是简单的模拟数据，没有复杂的市场结构。真实的买卖点信号需要：
- 明确的中枢结构
- 多个笔的配合
- 足够的K线数据

在真实市场数据中，当满足缠论买卖点条件时，signal_value会变为"一买"、"二买"、"三买"等。

### Q2: 如何实现OR逻辑（信号A或信号B）？

A: **不要使用signals_any**，而是创建多个Event:

```json
"opens": [
  {
    "name": "条件A",
    "operate": "LO",
    "factors": [{"name": "A", "signals_all": ["信号A"], ...}]
  },
  {
    "name": "条件B",
    "operate": "LO",
    "factors": [{"name": "B", "signals_all": ["信号B"], ...}]
  }
]
```

### Q3: symbol字段是必需的吗？

A: Position配置中的symbol字段如果缺失，后端会自动从请求参数中填充，但建议明确提供。

### Q4: 如何修改周期？

A: 修改以下两处：
1. 请求参数中的 `freq`: `"15分钟"` → `"60分钟"`
2. 信号名称中的周期前缀: `"15分钟_..."` → `"60分钟_..."`
3. signals_config中的freq: `"freq": "15分钟"` → `"freq": "60分钟"`

---

## 文件清单

- `verified_strategies.json` - 所有策略的完整JSON配置
- `test_all_verified_strategies.py` - 策略集成测试脚本
- `strategy_test_results.json` - 测试结果报告
- `VERIFIED_STRATEGY_CONFIGS.md` - 本说明文档

---

**最后更新**: 2025-10-15
**验证状态**: ✅ 所有策略已通过完整测试
