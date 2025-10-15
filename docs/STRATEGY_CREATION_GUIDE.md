# Position 策略创建指南

本文档详细说明如何创建和使用 CZSC Position 策略。

---

## 目录

1. [基本概念](#基本概念)
2. [策略结构](#策略结构)
3. [创建步骤](#创建步骤)
4. [完整示例](#完整示例)
5. [信号函数参考](#信号函数参考)
6. [最佳实践](#最佳实践)
7. [常见问题](#常见问题)

---

## 基本概念

### Position 策略的四层架构

```
Signal (信号)
    ↓
Factor (因子) = Signal 的逻辑组合
    ↓
Event (事件) = Factor 的集合（任一满足即触发）
    ↓
Position (策略) = Opens + Exits + 风控参数
```

### 核心组件

1. **Signal（信号）**
   - 最底层的技术指标和市场状态
   - 由 CZSC 信号函数自动生成
   - 例如：笔方向、买卖点、MACD、成交量等

2. **Factor（因子）**
   - 多个信号的逻辑组合
   - 支持 AND、OR、NOT 三种逻辑
   - 例如：MACD金叉 AND 笔向上 AND 成交量未缩量

3. **Event（事件）**
   - 开仓事件（Opens）或平仓事件（Exits）
   - 包含一个或多个 Factor
   - 任一 Factor 满足即触发事件

4. **Position（策略）**
   - 完整的交易策略
   - 包含开仓事件、平仓事件、风控参数

---

## 策略结构

### 完整的策略 JSON 结构

```json
{
  "strategy_id": "策略唯一标识",
  "name": "策略名称",
  "description": "策略描述",
  "category": "策略类别",

  "positions_config": [
    {
      "name": "持仓策略名称",
      "symbol": "交易标的",

      "opens": [
        {
          "operate": "操作类型",
          "factors": [
            {
              "name": "因子名称",
              "signals_all": ["必须同时满足的信号列表"],
        "signals_any": ["满足任一即可的信号列表"],
        "signals_not": ["不能出现的信号列表"]
            }
          ]
        }
      ],

      "exits": [
        {
          "operate": "操作类型",
          "factors": [...]
        }
      ],

      "interval": 0,
      "timeout": 100,
      "stop_loss": 200,
      "T0": false
    }
  ],

  "signals_config": [
    {
      "name": "信号函数名",
      "freq": "周期",
      "参数名": "参数值"
    }
  ],

  "ensemble_method": "mean",
  "fee_rate": 0.001,
  "digits": 2,
  "version": "1.0.0",
  "author": "作者",
  "tags": ["标签1", "标签2"]
}
```

### 字段说明

#### 基本信息
- `strategy_id`: 策略唯一ID，创建后不可修改
- `name`: 策略名称，便于识别
- `description`: 详细描述策略逻辑
- `category`: 类别（trend/reversal/arbitrage/multi_factor）
- `tags`: 标签数组，便于分类和搜索

#### Position 配置
- `name`: 持仓策略名称
- `symbol`: 交易标的代码（可在回测时覆盖）

#### 操作类型（operate）
- `LO`: Long Open - 开多仓
- `LE`: Long Exit - 平多仓
- `SO`: Short Open - 开空仓
- `SE`: Short Exit - 平空仓

#### Factor 逻辑

**⚠️ 重要：Factor 必须包含以下三个字段（即使为空数组）**

```json
{
  "name": "因子名称",
  "signals_all": [],  // 必填：所有信号必须同时满足（AND 逻辑）
  "signals_any": [],  // 必填：任意信号满足即可（OR 逻辑）
  "signals_not": []   // 必填：不能出现的信号（NOT 逻辑）
}
```

**字段说明**：
- `signals_all`: 所有信号必须同时满足（AND 逻辑）**⚠️ 不能为空数组，至少需要1个信号**
- `signals_any`: 任意信号满足即可（OR 逻辑），可以为空数组
- `signals_not`: 不能出现的信号（NOT 逻辑），可以为空数组
- 三个字段**必须全部存在**
- **关键限制**：`signals_all` 必须至少包含一个信号，否则会报错 "signals_all 不能为空"

**实现 OR 逻辑的正确方式**：
如果需要"任一买点触发"（OR 逻辑），有两种方法：
1. **推荐**：在 Event 中创建多个 Factor，每个 Factor 只包含一个信号
2. **不推荐**：单个 Factor 中把多个信号放到 `signals_all`（这变成了 AND 逻辑）

#### 风控参数
- `interval`: 开仓间隔（K线数），0表示无限制
- `timeout`: 持仓超时（K线数），超时自动平仓
- `stop_loss`: 止损（BP），1BP=0.01%，200表示2%
- `T0`: 是否支持T+0交易

#### 回测参数
- `ensemble_method`: 多策略集成方法（mean/vote/max）
- `fee_rate`: 手续费率（单边）
- `digits`: 权重小数位数

---

## 创建步骤

### 第一步：确定交易逻辑

回答以下问题：
1. **做多还是做空？** 单向或双向？
2. **开仓条件是什么？** 需要哪些信号？
3. **平仓条件是什么？** 止盈、止损、超时？
4. **风控如何设置？** 止损多少？多久超时？

### 第二步：选择信号函数

根据交易逻辑选择需要的信号函数：

| 策略类型 | 推荐信号函数 |
|---------|-------------|
| 笔方向策略 | `cxt_bi_base_V230228` |
| 买卖点策略 | `cxt_first_bs_V230228`<br>`cxt_second_bs_V230228`<br>`cxt_third_bs_V230318` |
| MACD策略 | `bar_macd_V230101` |
| 趋势策略 | `bar_sma_V230101`<br>`trend_strength_V230101` |
| 成交量策略 | `vol_ma_V230101` |

完整信号列表：
```bash
GET /api/v1/signals/list
```

### 第三步：构建策略配置

根据模板填写配置，参考[完整示例](#完整示例)。

### 第四步：调用 API 创建

```bash
POST /api/v1/strategy
Content-Type: application/json

{策略配置}
```

### 第五步：回测验证

```bash
POST /api/v1/backtest/czsc
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-09-01T00:00:00",
  "end_date": "2025-10-01T00:00:00",
  "strategy_id": "your_strategy_id"
}
```

---

## 完整示例

### 示例1：笔方向纯多头策略

**策略逻辑**：笔向上开多，笔向下平多

```json
{
  "strategy_id": "bi_direction_long_only_v1",
  "name": "笔方向纯多头策略",
  "description": "笔向上时开多仓，笔向下时平仓",
  "category": "trend",

  "positions_config": [{
    "name": "笔方向多头",
    "symbol": "BTCUSDT",

    "opens": [{
      "operate": "LO",
      "factors": [{
        "name": "笔向上",
        "signals_all": ["15m_D0BL9_V230228_向上_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      }]
    }],

    "exits": [{
      "operate": "LE",
      "factors": [{
        "name": "笔向下",
        "signals_all": ["15m_D0BL9_V230228_向下_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      }]
    }],

    "interval": 10,
    "timeout": 100,
    "stop_loss": 200,
    "T0": false
  }],

  "signals_config": [{
    "name": "czsc.signals.cxt.cxt_bi_base_V230228",
    "freq": "15m",
    "bi_init_length": 9
  }],

  "ensemble_method": "mean",
  "fee_rate": 0.001,
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["trend", "bi_direction", "long_only"]
}
```

### 示例2：笔方向多空双向策略

**策略逻辑**：笔向上开多平空，笔向下开空平多

```json
{
  "strategy_id": "bi_direction_bidirection_v1",
  "name": "笔方向多空双向策略",
  "description": "笔向上做多，笔向下做空",
  "category": "trend",

  "positions_config": [{
    "name": "笔方向双向",
    "symbol": "BTCUSDT",

    "opens": [
      {
        "operate": "LO",
        "factors": [{
          "name": "笔向上开多",
          "signals_all": ["15m_D0BL9_V230228_向上_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      }]
      },
      {
        "operate": "SO",
        "factors": [{
          "name": "笔向下开空",
          "signals_all": ["15m_D0BL9_V230228_向下_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      }]
      }
    ],

    "exits": [
      {
        "operate": "LE",
        "factors": [{
          "name": "笔向下平多",
          "signals_all": ["15m_D0BL9_V230228_向下_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      }]
      },
      {
        "operate": "SE",
        "factors": [{
          "name": "笔向上平空",
          "signals_all": ["15m_D0BL9_V230228_向上_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      }]
      }
    ],

    "interval": 5,
    "timeout": 100,
    "stop_loss": 200,
    "T0": false
  }],

  "signals_config": [{
    "name": "czsc.signals.cxt.cxt_bi_base_V230228",
    "freq": "15m",
    "bi_init_length": 9
  }],

  "ensemble_method": "mean",
  "fee_rate": 0.001,
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["trend", "bi_direction", "bidirection"]
}
```

### 示例3：缠论买卖点策略

**策略逻辑**：任一买点开多，任一卖点平多

**说明**：实现 OR 逻辑（任一买点）的正确方式是使用多个 Factor，每个 Factor 包含一个信号。Event 会在任一 Factor 满足时触发。

```json
{
  "strategy_id": "czsc_buypoint_v1",
  "name": "缠论买卖点策略",
  "description": "一买二买三买开多，一卖二卖三卖平多",
  "category": "trend",

  "positions_config": [{
    "name": "买卖点策略",
    "symbol": "BTCUSDT",

    "opens": [{
      "operate": "LO",
      "factors": [
        {
          "name": "一买",
          "signals_all": ["15m_D1BS_一买_任意_任意_任意_0"],
          "signals_any": [],
          "signals_not": []
        },
        {
          "name": "二买",
          "signals_all": ["15m_D2BS_二买_任意_任意_任意_0"],
          "signals_any": [],
          "signals_not": []
        },
        {
          "name": "三买",
          "signals_all": ["15m_D3BS_三买_任意_任意_任意_0"],
          "signals_any": [],
          "signals_not": []
        }
      ]
    }],

    "exits": [{
      "operate": "LE",
      "factors": [
        {
          "name": "一卖",
          "signals_all": ["15m_D1SS_一卖_任意_任意_任意_0"],
          "signals_any": [],
          "signals_not": []
        },
        {
          "name": "二卖",
          "signals_all": ["15m_D2SS_二卖_任意_任意_任意_0"],
          "signals_any": [],
          "signals_not": []
        },
        {
          "name": "三卖",
          "signals_all": ["15m_D3SS_三卖_任意_任意_任意_0"],
          "signals_any": [],
          "signals_not": []
        }
      ]
    }],

    "interval": 20,
    "timeout": 150,
    "stop_loss": 300,
    "T0": false
  }],

  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_first_bs_V230228",
      "freq": "15m"
    },
    {
      "name": "czsc.signals.cxt.cxt_second_bs_V230228",
      "freq": "15m"
    },
    {
      "name": "czsc.signals.cxt.cxt_third_bs_V230318",
      "freq": "15m"
    }
  ],

  "ensemble_method": "mean",
  "fee_rate": 0.001,
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["buypoint", "trend", "long_only"]
}
```

### 示例4：多因子组合策略

**策略逻辑**：笔向上 AND MACD金叉 AND 成交量不缩量 → 开多

```json
{
  "strategy_id": "multi_factor_v1",
  "name": "多因子组合策略",
  "description": "笔向上、MACD金叉、成交量放大三重确认",
  "category": "multi_factor",

  "positions_config": [{
    "name": "三重确认",
    "symbol": "BTCUSDT",

    "opens": [{
      "operate": "LO",
      "factors": [{
        "name": "三重确认开多",
        "signals_all": [
          "15m_D0BL9_V230228_向上_任意_任意_任意_0",
          "15m_MACD_金叉_任意_任意_任意_0"
        ],
        "signals_not": [
          "15m_VOL_缩量_任意_任意_任意_0"
        ]
      }]
    }],

    "exits": [
      {
        "operate": "LE",
        "factors": [
          {
            "name": "笔转向",
            "signals_all": ["15m_D0BL9_V230228_向下_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      },
          {
            "name": "MACD死叉",
            "signals_all": ["15m_MACD_死叉_任意_任意_任意_0"],
        "signals_any": [],
        "signals_not": []
      }
        ]
      }
    ],

    "interval": 15,
    "timeout": 80,
    "stop_loss": 200,
    "T0": false
  }],

  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_bi_base_V230228",
      "freq": "15m"
    },
    {
      "name": "czsc.signals.bar.bar_macd_V230101",
      "freq": "15m",
      "fast": 12,
      "slow": 26,
      "signal": 9
    },
    {
      "name": "czsc.signals.vol.vol_ma_V230101",
      "freq": "15m",
      "timeperiod": 20
    }
  ],

  "ensemble_method": "mean",
  "fee_rate": 0.001,
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["multi_factor", "trend", "confirmation"]
}
```

### 示例5：多级别联立策略

**策略逻辑**：大周期趋势向上 + 小周期买点 → 开多

```json
{
  "strategy_id": "multi_timeframe_v1",
  "name": "多级别联立策略",
  "description": "日线笔向上，15分钟三买开多",
  "category": "trend",

  "positions_config": [{
    "name": "大小周期共振",
    "symbol": "BTCUSDT",

    "opens": [{
      "operate": "LO",
      "factors": [{
        "name": "大小周期共振",
        "signals_all": [
          "1d_D0BL9_V230228_向上_任意_任意_任意_0",
          "15m_D3BS_三买_任意_任意_任意_0"
        ],
        "signals_any": [],
        "signals_not": []
      }]
    }],

    "exits": [{
      "operate": "LE",
      "factors": [{
        "name": "三卖或日线转向",
        "signals_all": [],
        "signals_any": [
          "15m_D3SS_三卖_任意_任意_任意_0",
          "1d_D0BL9_V230228_向下_任意_任意_任意_0"
        ],
        "signals_not": []
      }]
    }],

    "interval": 30,
    "timeout": 200,
    "stop_loss": 300,
    "T0": false
  }],

  "signals_config": [
    {
      "name": "czsc.signals.cxt.cxt_bi_base_V230228",
      "freq": "1d"
    },
    {
      "name": "czsc.signals.cxt.cxt_third_bs_V230318",
      "freq": "15m"
    }
  ],

  "ensemble_method": "mean",
  "fee_rate": 0.001,
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["multi_timeframe", "trend", "resonance"]
}
```

---

## 信号函数参考

### 常用信号函数

#### 1. 笔相关
```json
{
  "name": "czsc.signals.cxt.cxt_bi_base_V230228",
  "freq": "15m",
  "bi_init_length": 9
}
```
**生成信号**：
- `15m_D0BL9_V230228_向上_任意_任意_任意_0`
- `15m_D0BL9_V230228_向下_任意_任意_任意_0`

#### 2. 买卖点
```json
{
  "name": "czsc.signals.cxt.cxt_first_bs_V230228",
  "freq": "15m"
}
```
**生成信号**：
- `15m_D1BS_一买_任意_任意_任意_0`
- `15m_D1SS_一卖_任意_任意_任意_0`

```json
{
  "name": "czsc.signals.cxt.cxt_second_bs_V230228",
  "freq": "15m"
}
```
**生成信号**：
- `15m_D2BS_二买_任意_任意_任意_0`
- `15m_D2SS_二卖_任意_任意_任意_0`

```json
{
  "name": "czsc.signals.cxt.cxt_third_bs_V230318",
  "freq": "15m"
}
```
**生成信号**：
- `15m_D3BS_三买_任意_任意_任意_0`
- `15m_D3SS_三卖_任意_任意_任意_0`

#### 3. MACD
```json
{
  "name": "czsc.signals.bar.bar_macd_V230101",
  "freq": "15m",
  "fast": 12,
  "slow": 26,
  "signal": 9
}
```
**生成信号**：
- `15m_MACD_金叉_任意_任意_任意_0`
- `15m_MACD_死叉_任意_任意_任意_0`

#### 4. 成交量
```json
{
  "name": "czsc.signals.vol.vol_ma_V230101",
  "freq": "15m",
  "timeperiod": 20
}
```
**生成信号**：
- `15m_VOL_放量_任意_任意_任意_0`
- `15m_VOL_缩量_任意_任意_任意_0`

### 获取完整信号列表

```bash
GET /api/v1/signals/list
```

---

## 最佳实践

### 1. 策略命名规范

**strategy_id 建议格式**：
```
{策略类型}_{版本号}_v{数字}
```

示例：
- `bi_direction_long_v1`
- `buypoint_aggressive_v2`
- `multi_factor_macd_v1`

**name 建议**：
- 简洁明了，能体现策略核心逻辑
- 例如："笔方向纯多头策略"、"三买三卖保守策略"

### 2. 风控参数建议

| 周期 | interval | timeout | stop_loss |
|------|----------|---------|-----------|
| 1分钟 | 5-10 | 30-50 | 150-200 |
| 5分钟 | 5-10 | 50-80 | 150-200 |
| 15分钟 | 10-20 | 80-120 | 200-300 |
| 60分钟 | 10-20 | 100-150 | 300-500 |
| 日线 | 3-5 | 20-30 | 500-1000 |

**说明**：
- **interval**：避免频繁交易，降低手续费
- **timeout**：给趋势足够发展时间，但不能太长
- **stop_loss**：根据波动率调整，日线可以设更大

### 3. Factor 设计原则

**好的 Factor**：
```json
{
  "name": "强势突破",
  "signals_all": [
    "15m_D0BL9_V230228_向上_任意_任意_任意_0",
    "15m_MACD_金叉_任意_任意_任意_0"
  ],
        "signals_not": [
    "15m_VOL_缩量_任意_任意_任意_0"
  ]
}
```

**避免过度复杂**：
```json
// ❌ 条件太多，几乎不会触发
{
  "signals_all": [
    "信号1", "信号2", "信号3", "信号4", "信号5"
  ]
}
```

**原则**：
- `signals_all` 不超过 3 个
- `signals_any` 适合买卖点策略
- `signals_not` 用于排除明显不利条件

### 4. 版本管理

**开发流程**：
1. 创建 v1 版本，基础逻辑
2. 回测验证，记录绩效
3. 优化参数，创建 v2
4. 对比 v1 vs v2 绩效
5. 保留最佳版本，设为 active

**版本号规范**：
- v1：初始版本
- v2：参数优化
- v3：逻辑调整
- v10：大幅重构

### 5. 标签使用

**推荐标签**：
```json
"tags": [
  "trend",           // 策略类型
  "long_only",       // 交易方向
  "buypoint",        // 信号类型
  "aggressive",      // 风格
  "btc"              // 适用标的
]
```

**标签分类**：
- **类型**：trend/reversal/arbitrage/multi_factor
- **方向**：long_only/short_only/bidirection
- **信号**：buypoint/bi_direction/macd/volume
- **风格**：aggressive/conservative/balanced
- **标的**：btc/eth/stock/futures

---

## 常见问题

### Q1: 策略创建后能修改吗？

**A**: 可以修改，但 `strategy_id` 不能改。

```bash
PUT /api/v1/strategy/{strategy_id}
{
  "name": "新名称",
  "positions_config": [...]
}
```

建议：重大修改时创建新版本（v2），保留旧版本对比。

### Q2: 如何调试策略？

**A**:
1. 创建策略后立即回测
2. 查看交易明细，分析每笔交易
3. 检查信号是否正确触发
4. 调整参数，重新回测

```bash
# 1. 创建策略
POST /api/v1/strategy

# 2. 回测
POST /api/v1/backtest/czsc
{
  "strategy_id": "xxx",
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-09-01",
  "end_date": "2025-10-01"
}

# 3. 查看交易明细
# 返回结果中的 trades 数组
```

### Q3: 信号名称格式错误怎么办？

**A**: CZSC 信号名称必须严格遵循 7 段格式：

**正确格式**：`k1_k2_k3_v1_v2_v3_score`（7段，用下划线分隔）

示例：
- ✅ `15分钟_D1BS_一买_任意_任意_任意_0` (7段)
- ❌ `15分钟_D1BS_一买_任意_任意_0` (6段，缺少v2)

**说明**：
- `k1`: 周期（15分钟、日线等）
- `k2`: 信号函数标识（D1BS、D0BL9等）
- `k3`: 信号含义（一买、向上等）
- `v1, v2, v3`: 信号取值，未使用时填"任意"
- `score`: 信号得分（通常为0）

**前端注意**：
- 前端可传英文周期（`15m`），API 会自动转换为中文（`15分钟`）
- 但必须保证7段格式，否则会报错

### Q4: 策略回测交易数为 0？

**A**: 可能原因：
1. **信号名称错误** - 检查信号格式
2. **Factor 逻辑太严** - 放宽条件或使用 `signals_any`
3. **回测时间太短** - 至少选择 1 个月以上
4. **信号函数未配置** - 检查 `signals_config` 是否包含对应函数

### Q5: 如何实现只做三买？

**A**:
```json
{
  "opens": [{
    "operate": "LO",
    "factors": [{
      "signals_all": ["15m_D3BS_三买_任意_任意_任意_0"]
    }]
  }],
  "signals_config": [{
    "name": "czsc.signals.cxt.cxt_third_bs_V230318",
    "freq": "15m"
  }]
}
```

### Q6: 如何避免频繁交易？

**A**: 增加 `interval` 参数：
```json
{
  "interval": 20,  // 平仓后等待 20 根 K 线
  "timeout": 100,
  "stop_loss": 200
}
```

### Q7: 多个 Position 如何工作？

**A**:
```json
{
  "positions_config": [
    {
      "name": "激进策略",
      "interval": 5,
      "opens": [...]
    },
    {
      "name": "保守策略",
      "interval": 20,
      "opens": [...]
    }
  ],
  "ensemble_method": "mean"  // 两个策略的权重取平均
}
```

多策略会按 `ensemble_method` 集成：
- `mean`: 权重平均
- `vote`: 投票表决
- `max`: 取最大值

### Q8: 前端如何获取信号名称？

**A**:
1. 调用信号列表接口：
   ```bash
   GET /api/v1/signals/list
   ```

2. 或参考文档中的[信号函数参考](#信号函数参考)

3. 通用格式：`{周期}_{信号函数}_{状态}`

### Q9: 如何实现止盈？

**A**: 两种方式：

**方式1：使用超时**
```json
{
  "timeout": 50,  // 持仓 50 根 K 线后自动平仓
  "stop_loss": 200
}
```

**方式2：使用特定信号**（需要自定义信号函数）
```json
{
  "exits": [{
    "operate": "LE",
    "factors": [{
      "signals_any": [
        "15m_PROFIT_5%_任意_任意_任意_0",  // 自定义盈利信号（需开发）
        "15m_D0BL9_V230228_向下_任意_任意_任意_0"
      ]
    }]
  }]
}
```

### Q10: 策略可以跨标的使用吗？

**A**: 可以！Position 配置中的 `symbol` 字段会被回测时的参数覆盖：

```json
// 策略创建时
{
  "positions_config": [{
    "symbol": "BTCUSDT"  // 这是默认值
  }]
}

// 回测时可以换标的
{
  "symbol": "ETHUSDT",  // 使用 ETH 回测
  "strategy_id": "xxx"
}
```

---

## 附录：API 端点

### 策略管理

```bash
# 创建策略
POST /api/v1/strategy

# 查询列表
GET /api/v1/strategy/list?limit=20&category=trend

# 查询详情
GET /api/v1/strategy/{strategy_id}

# 更新策略
PUT /api/v1/strategy/{strategy_id}

# 删除策略
DELETE /api/v1/strategy/{strategy_id}?hard_delete=false
```

### 回测

```bash
# CZSC 回测
POST /api/v1/backtest/czsc

# 回测列表
GET /api/v1/backtest/list?limit=20

# 回测详情
GET /api/v1/backtest/{task_id}
```

### 信号

```bash
# 信号列表
GET /api/v1/signals/list

# 信号查询
POST /api/v1/signals/query
```

---

## 联系和反馈

如有问题或建议，请：
1. 查看 [API_REFERENCE.md](./API_REFERENCE.md)
2. 查看 Swagger 文档：http://localhost:8000/docs
3. 提交 Issue 或联系开发团队

---

**祝你策略开发顺利！** 🚀
