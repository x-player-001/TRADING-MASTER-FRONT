# CZSC 回测系统 API 文档

## 概述

本文档描述了CZSC回测系统的RESTful API接口，包括K线分析、信号存储和回测功能。

**Base URL**: `http://localhost:8000`

---

## 1. K线分析接口

### 1.1 分析K线数据

分析指定标的的K线数据，生成缠论信号。

**接口**: `POST /api/v1/analyze`

**请求参数**:

```json
{
  "symbol": "BTCUSDT",           // 必填：标的代码
  "freq": "15m",                 // 必填：周期 (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
  "sdt": "2025-10-01T00:00:00", // 可选：开始时间 (ISO 8601格式)
  "edt": "2025-10-10T00:00:00", // 可选：结束时间
  "limit": 1000                  // 可选：K线数量限制，默认1000
}
```

**响应示例**:

```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "bars_count": 858,
  "signals_count": 358,
  "bi_list": [
    {
      "dt": "2025-10-01T00:15:00",
      "direction": "up",
      "high": 114246.0,
      "low": 113988.7,
      "power": 257.3
    }
  ],
  "signals": [
    {
      "dt": "2025-10-05T21:15:00",
      "15分钟_D1_分型": "顶分型",
      "15分钟_D1_笔方向": "向下",
      "15分钟_D1_BS3辅助": "三卖_倒九_倒九_0"
    }
  ],
  "latest_price": 121583.8,
  "task_id": "analyze_20251010_123456"
}
```

**说明**:
- 分析结果会自动保存到数据库（`signal_records`和`signal_summary`表）
- `bi_list`: 笔的列表
- `signals`: 每根K线的信号详情

---

## 2. 回测接口

### 2.1 基于信号的回测

基于买卖点信号进行回测，自动识别一买/二买/三买和一卖/二卖/三卖信号。

**接口**: `POST /api/v1/backtest/signal`

**请求参数**:

```json
{
  "symbol": "BTCUSDT",                    // 必填：标的代码
  "freq": "15m",                          // 必填：周期
  "start_date": "2025-10-01T00:00:00",  // 必填：回测开始时间
  "end_date": "2025-10-10T00:00:00",    // 必填：回测结束时间
  "signal_config": {
    "signal_names": [                     // 必填：信号函数名称列表
      "cxt_third_bs_V230318",            // 三买三卖
      "tas_first_bs_V230217"             // 一买一卖
    ],
    "fee_rate": 0.0002,                  // 可选：手续费率，默认0.0002 (0.02%)
    "initial_cash": 100000               // 可选：初始资金，默认100000
  }
}
```

**响应示例**:

```json
{
  "task_id": "20251010231651_BTCUSDT_15m_signal",
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-10-01T00:00:00",
  "end_date": "2025-10-10T00:00:00",
  "status": "completed",
  "stats": {
    "total_return": -0.016,
    "annual_return": -0.663,
    "cumulative_return": -0.016,
    "max_drawdown": 0.0341,
    "sharpe_ratio": 0.0,
    "calmar_ratio": -19.4181,
    "sortino_ratio": 0,
    "volatility": 0.0,
    "total_trades": 1,
    "winning_trades": 0,
    "losing_trades": 1,
    "win_rate": 0.0,
    "avg_profit": 0,
    "avg_loss": -1596.75,
    "profit_loss_ratio": 0,
    "avg_holding_bars": 108,
    "max_holding_bars": 108,
    "break_even_point": 0.0004,
    "avg_profit_per_trade": -1596.75
  },
  "trades": [
    {
      "entry_time": "2025-10-08T06:15:00",
      "exit_time": "2025-10-09T10:15:00",
      "entry_price": 122543.5,
      "exit_price": 120635.8,
      "profit": -1596.75,
      "profit_rate": -0.0160,
      "entry_signal": "15分钟_D1N10#SMA#5_BS1辅助V230217:一买_倒九_倒九_0",
      "exit_signal": "15分钟_D1#SMA#34_BS3辅助V230318:三卖_倒九_倒九_0"
    }
  ],
  "trades_count": 1,
  "equity_curve": [
    {
      "dt": "2025-10-05T21:15:00",
      "equity": 100000,
      "price": 123552.1
    }
  ]
}
```

**策略逻辑（预设）**:
- 检测到买点信号（一买/二买/三买/看多/做多）→ 开多仓（满仓）
- 检测到卖点信号（一卖/二卖/三卖/看空/做空）→ 平多仓
- 暂不支持做空和自定义开平仓逻辑

**统计字段说明**:

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `total_return` | float | 总收益率 |
| `annual_return` | float | 年化收益率 |
| `cumulative_return` | float | 累计收益率 |
| `max_drawdown` | float | 最大回撤 |
| `sharpe_ratio` | float | 夏普比率 |
| `calmar_ratio` | float | 卡玛比率（年化收益/最大回撤） |
| `sortino_ratio` | float | 索提诺比率 |
| `volatility` | float | 波动率（年化） |
| `total_trades` | int | 交易次数 |
| `winning_trades` | int | 盈利次数 |
| `losing_trades` | int | 亏损次数 |
| `win_rate` | float | 交易胜率 |
| `avg_profit` | float | 平均盈利金额 |
| `avg_loss` | float | 平均亏损金额 |
| `profit_loss_ratio` | float | 盈亏比 |
| `avg_holding_bars` | int | 平均持仓K线数 |
| `max_holding_bars` | int | 最大持仓K线数 |
| `break_even_point` | float | 盈亏平衡点 |
| `avg_profit_per_trade` | float | 单笔平均收益 |

---

### 2.2 基于权重的回测（简化版）

基于笔的方向变化进行权重回测。

**接口**: `POST /api/v1/backtest`

**请求参数**:

```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-10-01T00:00:00",
  "end_date": "2025-10-10T00:00:00",
  "strategy_config": {
    "signal_names": ["cxt_bi_end_V230104"],  // 信号函数（用于生成权重）
    "weight_method": "mean",                  // 权重计算方法: mean/max/min
    "fee_rate": 0.0002
  }
}
```

**响应格式**: 与信号回测类似

**说明**:
- 此方法根据笔的方向自动生成权重（向上笔=1.0，向下笔=-1.0）
- 适用于趋势跟踪策略
- 不适合离散的买卖点策略

---

### 2.3 查询回测结果列表

获取历史回测任务列表。

**接口**: `GET /api/v1/backtest/list`

**查询参数**:

```
?symbol=BTCUSDT     // 可选：标的代码
&freq=15m           // 可选：周期
&limit=20           // 可选：返回数量，默认20
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 15,
    "results": [
      {
        "id": 1,
        "task_id": "20251010231651_BTCUSDT_15m_signal",
        "symbol": "BTCUSDT",
        "freq": "15m",
        "start_date": "2025-10-01T00:00:00",
        "end_date": "2025-10-10T00:00:00",
        "total_return": -0.016,
        "annual_return": -0.663,
        "cumulative_return": -0.016,
        "max_drawdown": 0.0341,
        "sharpe_ratio": 0.0,
        "calmar_ratio": -19.4181,
        "sortino_ratio": 0,
        "volatility": 0.0,
        "total_trades": 1,
        "win_trades": 0,
        "loss_trades": 1,
        "win_rate": 0.0,
        "avg_profit": 0,
        "avg_loss": -1596.75,
        "profit_factor": 0,
        "avg_holding_bars": 108,
        "max_holding_bars": 108,
        "break_even_point": 0.0004,
        "single_trade_return": -1596.75,
        "stats_data": { /* 完整统计数据JSON */ },
        "created_at": "2025-10-10T23:16:51"
      }
    ]
  }
}
```

**说明**:
- 列表接口返回所有统计指标，但**不包含** `equity_curve` 和 `trades_data`（减少响应大小）
- 如需完整的权益曲线和交易明细，请使用详情接口 `GET /api/v1/backtest/{task_id}`
```

---

### 2.4 查询单个回测详情

获取指定回测任务的完整结果，包括权益曲线和交易明细。

**接口**: `GET /api/v1/backtest/{task_id}`

**路径参数**:
- `task_id`: 回测任务ID

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "task_id": "20251010231651_BTCUSDT_15m_signal",
    "symbol": "BTCUSDT",
    "freq": "15m",
    "start_date": "2025-10-01T00:00:00",
    "end_date": "2025-10-10T00:00:00",
    "total_return": -0.016,
    "annual_return": -0.663,
    "max_drawdown": 0.0341,
    "sharpe_ratio": 0.0,
    "total_trades": 1,
    "win_rate": 0.0,
    "stats_data": {
      "total_return": -0.016,
      "annual_return": -0.663,
      "cumulative_return": -0.016,
      "max_drawdown": 0.0341,
      "sharpe_ratio": 0.0,
      "calmar_ratio": -19.4181,
      "sortino_ratio": 0,
      "volatility": 0.0,
      "total_trades": 1,
      "winning_trades": 0,
      "losing_trades": 1,
      "win_rate": 0.0,
      "avg_profit": 0,
      "avg_loss": -1596.75,
      "profit_loss_ratio": 0,
      "avg_holding_bars": 108,
      "max_holding_bars": 108,
      "break_even_point": 0.0004,
      "avg_profit_per_trade": -1596.75
    },
    "equity_curve": [
      {
        "dt": "2025-10-05T21:15:00",
        "equity": 100000,
        "price": 123552.1
      },
      {
        "dt": "2025-10-05T21:30:00",
        "equity": 98403.25,
        "price": 120635.8
      }
    ],
    "trades_data": [
      {
        "entry_time": "2025-10-08T06:15:00",
        "exit_time": "2025-10-09T10:15:00",
        "entry_price": 122543.5,
        "exit_price": 120635.8,
        "profit": -1596.75,
        "profit_rate": -0.0160,
        "entry_signal": "15分钟_D1N10#SMA#5_BS1辅助V230217:一买_倒九_倒九_0",
        "exit_signal": "15分钟_D1#SMA#34_BS3辅助V230318:三卖_倒九_倒九_0"
      }
    ],
    "created_at": "2025-10-10T23:16:51"
  }
}
```

**与列表接口的区别**:
- ✅ 包含完整的 `equity_curve`（权益曲线）
- ✅ 包含完整的 `trades_data`（交易明细）
- ✅ 包含完整的 `stats_data`（统计数据JSON）

---

## 3. 可用信号列表

### 3.1 买卖点信号（适合信号回测）

| 信号名称 | 说明 | 推荐场景 |
|---------|------|---------|
| `tas_first_bs_V230217` | 一买一卖 | 趋势启动 |
| `cxt_second_bs_V230320` | 二买二卖 | 趋势确认 |
| `cxt_third_bs_V230318` | 三买三卖 | 趋势延续 |
| `tas_macd_bs1_V230312` | MACD买卖点 | 结合技术指标 |
| `tas_dma_bs_V240608` | DMA买卖点 | 趋势跟踪 |
| `bar_vol_bs1_V230224` | 成交量买卖点 | 量价分析 |

### 3.2 其他常用信号

| 信号名称 | 说明 |
|---------|------|
| `cxt_bi_status_V230101` | 笔状态 |
| `cxt_bi_end_V230104` | 笔结束 |
| `cxt_fx_power_V230227` | 分型力度 |

**获取完整信号列表**:
```python
from czsc import signals
import inspect

# 列出所有买卖点信号
bs_signals = [name for name in dir(signals)
              if 'bs' in name.lower() and not name.startswith('_')]
print(bs_signals)
```

---

## 4. 数据模型

### 4.1 回测任务 (backtest_tasks)

| 字段 | 类型 | 说明 |
|-----|------|-----|
| task_id | VARCHAR(100) | 任务ID（主键） |
| symbol | VARCHAR(20) | 标的代码 |
| freq | VARCHAR(10) | 周期 |
| start_date | DATETIME | 开始时间 |
| end_date | DATETIME | 结束时间 |
| status | VARCHAR(20) | 状态：pending/running/completed/failed |
| strategy_config | JSON | 策略配置 |
| created_at | DATETIME | 创建时间 |

### 4.2 回测结果 (backtest_results)

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INT | 自增ID（主键） |
| task_id | VARCHAR(100) | 关联任务ID |
| total_return | DECIMAL | 总收益率 |
| annual_return | DECIMAL | 年化收益率 |
| max_drawdown | DECIMAL | 最大回撤 |
| sharpe_ratio | DECIMAL | 夏普比率 |
| total_trades | INT | 交易次数 |
| win_rate | DECIMAL | 胜率 |
| stats_data | JSON | 完整统计数据 |
| equity_curve | JSON | 权益曲线 |
| trades_data | JSON | 交易明细 |

### 4.3 信号记录 (signal_records)

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INT | 自增ID |
| task_id | VARCHAR(100) | 分析任务ID |
| symbol | VARCHAR(20) | 标的代码 |
| freq | VARCHAR(10) | 周期 |
| dt | DATETIME | K线时间 |
| signal_name | VARCHAR(100) | 信号名称 |
| signal_value | VARCHAR(100) | 信号值 |

### 4.4 信号汇总 (signal_summary)

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INT | 自增ID |
| task_id | VARCHAR(100) | 分析任务ID |
| symbol | VARCHAR(20) | 标的代码 |
| freq | VARCHAR(10) | 周期 |
| bars_count | INT | K线数量 |
| bi_count | INT | 笔数量 |
| signals_data | JSON | 信号统计 |

---

## 5. 错误码

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

**错误响应格式**:
```json
{
  "error": "错误类型",
  "message": "详细错误信息",
  "details": {
    "field": "具体字段",
    "reason": "错误原因"
  }
}
```

---

## 6. 使用示例

### 6.1 Python 示例

```python
import requests

# 1. 执行信号回测
response = requests.post('http://localhost:8000/api/v1/backtest/signal', json={
    "symbol": "BTCUSDT",
    "freq": "15m",
    "start_date": "2025-10-01T00:00:00",
    "end_date": "2025-10-10T00:00:00",
    "signal_config": {
        "signal_names": ["cxt_third_bs_V230318", "tas_first_bs_V230217"],
        "fee_rate": 0.0002,
        "initial_cash": 100000
    }
})

result = response.json()
print(f"任务ID: {result['task_id']}")
print(f"总收益: {result['stats']['total_return']}")
print(f"交易次数: {result['stats']['total_trades']}")

# 2. 查询回测列表
response = requests.get('http://localhost:8000/api/v1/backtest/list?symbol=BTCUSDT&limit=10')
backtest_list = response.json()

# 3. 获取回测详情
task_id = backtest_list['results'][0]['task_id']
response = requests.get(f'http://localhost:8000/api/v1/backtest/{task_id}')
details = response.json()
```

### 6.2 JavaScript (Fetch) 示例

```javascript
// 执行回测
const runBacktest = async () => {
  const response = await fetch('http://localhost:8000/api/v1/backtest/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: 'BTCUSDT',
      freq: '15m',
      start_date: '2025-10-01T00:00:00',
      end_date: '2025-10-10T00:00:00',
      signal_config: {
        signal_names: ['cxt_third_bs_V230318', 'tas_first_bs_V230217'],
        fee_rate: 0.0002,
        initial_cash: 100000
      }
    })
  });

  const result = await response.json();
  console.log('回测结果:', result);
};

// 查询列表
const getBacktestList = async () => {
  const response = await fetch('http://localhost:8000/api/v1/backtest/list?limit=10');
  const list = await response.json();
  console.log('回测列表:', list);
};
```

### 6.3 cURL 示例

```bash
# 执行信号回测
curl -X POST http://localhost:8000/api/v1/backtest/signal \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "freq": "15m",
    "start_date": "2025-10-01T00:00:00",
    "end_date": "2025-10-10T00:00:00",
    "signal_config": {
      "signal_names": ["cxt_third_bs_V230318", "tas_first_bs_V230217"],
      "fee_rate": 0.0002
    }
  }'

# 查询回测列表
curl http://localhost:8000/api/v1/backtest/list?symbol=BTCUSDT&limit=10

# 获取回测详情
curl http://localhost:8000/api/v1/backtest/20251010231651_BTCUSDT_15m_signal
```

---

## 7. 注意事项

### 7.1 性能建议

- 单次回测K线数量建议不超过10000根
- 信号数量建议不超过10个
- 大批量回测请分批调用

### 7.2 信号回测策略说明

**当前策略逻辑（固定）**:
- ✅ 检测到买点关键词（一买/二买/三买/看多/做多） → 开多仓（满仓）
- ✅ 检测到卖点关键词（一卖/二卖/三卖/看空/做空） → 平多仓
- ❌ 不支持：做空、自定义开平仓条件、止损止盈、仓位管理

**如需自定义策略**，请使用原项目的 `CzscStrategyBase` 编写策略类。

### 7.3 数据要求

- 数据库中必须存在对应标的和周期的K线数据（`kline_*` 表）
- K线数据必须连续，不能有缺失
- 时间范围内至少需要500根K线用于初始化

---

## 8. 策略管理接口

### 8.1 创建策略

创建一个新的交易策略。

**接口**: `POST /api/v1/strategy`

**请求参数**:

```json
{
  "strategy_id": "my_strategy_001",           // 必填：策略唯一标识
  "name": "我的三买三卖策略",                 // 必填：策略名称
  "description": "基于三买三卖信号的策略",    // 可选：策略描述
  "author": "trader001",                      // 可选：作者
  "version": "1.0.0",                         // 可选：版本号，默认1.0.0
  "signals": [                                // 必填：使用的信号列表
    {
      "name": "cxt_third_bs_V230318",         // 信号函数名
      "freq": "15分钟"                        // 周期
    }
  ],
  "entry_rules": {                            // 必填：入场规则
    "operator": "OR",                         // 条件组合方式：AND/OR
    "conditions": [
      {
        "type": "signal_match",               // 条件类型：signal_match
        "signal_pattern": "*三买*",           // 信号模式（支持通配符）
        "description": "检测到三买信号"       // 可选：条件描述
      }
    ]
  },
  "exit_rules": {                             // 必填：出场规则
    "operator": "OR",
    "conditions": [
      {
        "type": "signal_match",
        "signal_pattern": "*三卖*"
      },
      {
        "type": "stop_loss",                  // 止损
        "value": -0.03,                       // 止损比例（-3%）
        "description": "止损3%"
      },
      {
        "type": "take_profit",                // 止盈
        "value": 0.08,                        // 止盈比例（8%）
        "description": "止盈8%"
      }
    ]
  },
  "position_sizing": {                        // 可选：仓位管理
    "type": "fixed",                          // 类型：fixed/percentage/kelly
    "value": 1.0                              // 固定仓位（1.0=满仓）
  },
  "risk_management": {                        // 可选：风控设置
    "max_position": 1.0,                      // 最大仓位
    "max_loss_per_trade": 0.03,               // 单笔最大亏损
    "max_daily_loss": 0.10                    // 日内最大亏损
  }
}
```

**响应示例**:

```json
{
  "success": true,
  "strategy_id": "my_strategy_001",
  "message": "Strategy my_strategy_001 created successfully"
}
```

**条件类型说明**:

| 类型 | 说明 | 参数 |
|-----|------|-----|
| `signal_match` | 信号匹配 | `signal_pattern`: 信号模式（支持*通配符） |
| `stop_loss` | 止损 | `value`: 止损比例（负数，如-0.03表示-3%） |
| `take_profit` | 止盈 | `value`: 止盈比例（正数，如0.05表示5%） |
| `holding_bars` | 持仓时间 | `value`: 最多持仓K线数 |

---

### 8.2 从模板创建策略

使用预定义模板快速创建策略。

**接口**: `POST /api/v1/strategy/from_template`

**请求参数**:

```json
{
  "template_id": "template_simple_bs",        // 必填：模板ID
  "strategy_id": "my_new_strategy",          // 必填：新策略ID
  "name": "我的第一个策略",                   // 必填：策略名称
  "author": "trader001"                       // 可选：作者
}
```

**响应示例**: 与创建策略相同

---

### 8.3 获取策略列表

获取所有策略列表。

**接口**: `GET /api/v1/strategy/list`

**查询参数**:

```
?limit=20           // 可选：返回数量，默认20
&offset=0           // 可选：偏移量，默认0
&author=trader001   // 可选：按作者筛选
&is_active=true     // 可选：按启用状态筛选
```

**响应示例**:

```json
{
  "total": 5,
  "strategies": [
    {
      "strategy_id": "my_strategy_001",
      "name": "我的三买三卖策略",
      "description": "基于三买三卖信号的策略",
      "author": "trader001",
      "version": "1.0.0",
      "is_active": true,
      "created_at": "2025-10-10T12:00:00",
      "updated_at": "2025-10-10T12:00:00"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

---

### 8.4 获取策略详情

获取指定策略的完整配置。

**接口**: `GET /api/v1/strategy/{strategy_id}`

**路径参数**:
- `strategy_id`: 策略ID

**响应示例**:

```json
{
  "strategy_id": "my_strategy_001",
  "name": "我的三买三卖策略",
  "description": "基于三买三卖信号的策略",
  "author": "trader001",
  "version": "1.0.0",
  "is_active": true,
  "created_at": "2025-10-10T12:00:00",
  "updated_at": "2025-10-10T12:00:00",
  "signals": [
    {
      "name": "cxt_third_bs_V230318",
      "freq": "15分钟"
    }
  ],
  "entry_rules": {
    "operator": "OR",
    "conditions": [
      {
        "type": "signal_match",
        "signal_pattern": "*三买*",
        "description": "检测到三买信号"
      }
    ]
  },
  "exit_rules": {
    "operator": "OR",
    "conditions": [
      {
        "type": "signal_match",
        "signal_pattern": "*三卖*"
      },
      {
        "type": "stop_loss",
        "value": -0.03,
        "description": "止损3%"
      }
    ]
  },
  "position_sizing": {
    "type": "fixed",
    "value": 1.0
  },
  "risk_management": {
    "max_position": 1.0,
    "max_loss_per_trade": 0.03
  }
}
```

---

### 8.5 更新策略

更新策略配置（支持部分更新）。

**接口**: `PUT /api/v1/strategy/{strategy_id}`

**路径参数**:
- `strategy_id`: 策略ID

**请求参数**:

```json
{
  "name": "更新后的策略名称",              // 可选
  "description": "更新后的描述",           // 可选
  "is_active": false,                     // 可选：禁用策略
  "exit_rules": {                         // 可选：更新出场规则
    "operator": "OR",
    "conditions": [
      {
        "type": "stop_loss",
        "value": -0.05
      }
    ]
  }
}
```

**响应示例**:

```json
{
  "success": true,
  "strategy_id": "my_strategy_001",
  "message": "Strategy my_strategy_001 updated successfully"
}
```

---

### 8.6 删除策略

删除指定策略。

**接口**: `DELETE /api/v1/strategy/{strategy_id}`

**路径参数**:
- `strategy_id`: 策略ID

**响应示例**:

```json
{
  "success": true,
  "strategy_id": "my_strategy_001",
  "message": "Strategy my_strategy_001 deleted successfully"
}
```

---

### 8.7 获取策略回测历史

获取策略的历史回测记录。

**接口**: `GET /api/v1/strategy/{strategy_id}/backtests`

**路径参数**:
- `strategy_id`: 策略ID

**查询参数**:
```
?limit=10           // 可选：返回数量，默认10
```

**响应示例**:

```json
{
  "strategy_id": "my_strategy_001",
  "total": 3,
  "backtests": [
    {
      "backtest_task_id": "20251010231651_BTCUSDT_15m_signal",
      "backtest_time": "2025-10-10T23:16:51",
      "total_return": -0.016,
      "max_drawdown": 0.0341,
      "sharpe_ratio": 0.0,
      "trades_count": 1
    }
  ]
}
```

---

### 8.8 获取策略模板列表

获取所有预定义策略模板。

**接口**: `GET /api/v1/strategy/template/list`

**查询参数**:

```
?category=趋势跟踪      // 可选：按类别筛选
&difficulty=beginner   // 可选：按难度筛选 (beginner/intermediate/advanced)
```

**响应示例**:

```json
{
  "total": 5,
  "templates": [
    {
      "template_id": "template_simple_bs",
      "name": "简单买卖点策略",
      "category": "趋势跟踪",
      "description": "基于单一买卖点信号的简单策略，适合初学者",
      "difficulty": "beginner",
      "created_at": "2025-10-10T00:00:00"
    },
    {
      "template_id": "template_combo_macd",
      "name": "买卖点+MACD组合",
      "category": "组合策略",
      "description": "结合买卖点和MACD指标的组合策略",
      "difficulty": "intermediate",
      "created_at": "2025-10-10T00:00:00"
    }
  ]
}
```

**内置模板**:

| 模板ID | 名称 | 类别 | 难度 | 说明 |
|-------|-----|------|------|-----|
| `template_simple_bs` | 简单买卖点策略 | 趋势跟踪 | beginner | 单一买卖点信号 |
| `template_combo_macd` | 买卖点+MACD组合 | 组合策略 | intermediate | 买卖点+MACD金叉 |
| `template_risk_control` | 严格风控策略 | 风险管理 | advanced | 带止损止盈 |
| `template_multi_signal` | 多信号确认策略 | 组合策略 | intermediate | 多信号同时确认 |
| `template_trend_following` | 趋势跟踪策略 | 趋势跟踪 | beginner | 顺势交易 |

---

### 8.9 获取模板详情

获取指定模板的完整配置。

**接口**: `GET /api/v1/strategy/template/{template_id}`

**路径参数**:
- `template_id`: 模板ID

**响应示例**:

```json
{
  "template_id": "template_simple_bs",
  "name": "简单买卖点策略",
  "category": "趋势跟踪",
  "description": "基于单一买卖点信号的简单策略，适合初学者",
  "difficulty": "beginner",
  "config_template": {
    "signals": [
      {
        "name": "cxt_third_bs_V230318",
        "freq": "15分钟"
      }
    ],
    "entry_rules": {
      "operator": "OR",
      "conditions": [
        {
          "type": "signal_match",
          "signal_pattern": "*三买*",
          "description": "检测到三买信号"
        }
      ]
    },
    "exit_rules": {
      "operator": "OR",
      "conditions": [
        {
          "type": "signal_match",
          "signal_pattern": "*三卖*",
          "description": "检测到三卖信号"
        }
      ]
    },
    "position_sizing": {
      "type": "fixed",
      "value": 1.0,
      "description": "固定满仓"
    }
  },
  "created_at": "2025-10-10T00:00:00"
}
```

---

## 9. 策略管理使用示例

### 9.1 Python 示例

```python
import requests

base_url = 'http://localhost:8000/api/v1'

# 1. 获取模板列表
response = requests.get(f'{base_url}/strategy/template/list')
templates = response.json()
print(f"可用模板: {templates['total']}个")

# 2. 从模板创建策略
response = requests.post(f'{base_url}/strategy/from_template', json={
    "template_id": "template_simple_bs",
    "strategy_id": "my_first_strategy",
    "name": "我的第一个策略",
    "author": "trader001"
})
result = response.json()
print(f"创建成功: {result['strategy_id']}")

# 3. 获取策略详情
response = requests.get(f'{base_url}/strategy/my_first_strategy')
strategy = response.json()
print(f"策略名称: {strategy['name']}")
print(f"信号数量: {len(strategy['signals'])}")

# 4. 创建自定义策略
response = requests.post(f'{base_url}/strategy', json={
    "strategy_id": "custom_strategy_001",
    "name": "自定义策略",
    "author": "trader001",
    "signals": [
        {"name": "cxt_third_bs_V230318", "freq": "15分钟"},
        {"name": "tas_macd_bs1_V230312", "freq": "15分钟"}
    ],
    "entry_rules": {
        "operator": "AND",
        "conditions": [
            {"type": "signal_match", "signal_pattern": "*三买*"},
            {"type": "signal_match", "signal_pattern": "*金叉*"}
        ]
    },
    "exit_rules": {
        "operator": "OR",
        "conditions": [
            {"type": "signal_match", "signal_pattern": "*三卖*"},
            {"type": "stop_loss", "value": -0.05}
        ]
    }
})

# 5. 更新策略
response = requests.put(f'{base_url}/strategy/my_first_strategy', json={
    "description": "更新后的描述",
    "exit_rules": {
        "operator": "OR",
        "conditions": [
            {"type": "signal_match", "signal_pattern": "*三卖*"},
            {"type": "stop_loss", "value": -0.03},
            {"type": "take_profit", "value": 0.08}
        ]
    }
})

# 6. 获取策略列表
response = requests.get(f'{base_url}/strategy/list?author=trader001')
strategies = response.json()
print(f"我的策略: {strategies['total']}个")

# 7. 删除策略
response = requests.delete(f'{base_url}/strategy/my_first_strategy')
print(response.json()['message'])
```

### 9.2 JavaScript (Fetch) 示例

```javascript
const baseUrl = 'http://localhost:8000/api/v1';

// 从模板创建策略
const createFromTemplate = async () => {
  const response = await fetch(`${baseUrl}/strategy/from_template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: 'template_simple_bs',
      strategy_id: 'my_first_strategy',
      name: '我的第一个策略',
      author: 'trader001'
    })
  });

  const result = await response.json();
  console.log('策略创建成功:', result);
};

// 创建自定义策略
const createCustomStrategy = async () => {
  const response = await fetch(`${baseUrl}/strategy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      strategy_id: 'custom_001',
      name: '自定义策略',
      author: 'trader001',
      signals: [
        { name: 'cxt_third_bs_V230318', freq: '15分钟' }
      ],
      entry_rules: {
        operator: 'OR',
        conditions: [
          { type: 'signal_match', signal_pattern: '*三买*' }
        ]
      },
      exit_rules: {
        operator: 'OR',
        conditions: [
          { type: 'signal_match', signal_pattern: '*三卖*' },
          { type: 'stop_loss', value: -0.03 }
        ]
      }
    })
  });

  const result = await response.json();
  console.log('自定义策略创建:', result);
};

// 获取策略列表
const getStrategies = async () => {
  const response = await fetch(`${baseUrl}/strategy/list?limit=20`);
  const list = await response.json();
  console.log('策略列表:', list);
};

// 更新策略
const updateStrategy = async (strategyId) => {
  const response = await fetch(`${baseUrl}/strategy/${strategyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '更新后的名称',
      is_active: true
    })
  });

  const result = await response.json();
  console.log('更新结果:', result);
};
```

### 9.3 cURL 示例

```bash
# 获取模板列表
curl http://localhost:8000/api/v1/strategy/template/list

# 从模板创建策略
curl -X POST http://localhost:8000/api/v1/strategy/from_template \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "template_simple_bs",
    "strategy_id": "my_first_strategy",
    "name": "我的第一个策略",
    "author": "trader001"
  }'

# 创建自定义策略
curl -X POST http://localhost:8000/api/v1/strategy \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": "custom_001",
    "name": "自定义策略",
    "author": "trader001",
    "signals": [
      {"name": "cxt_third_bs_V230318", "freq": "15分钟"}
    ],
    "entry_rules": {
      "operator": "OR",
      "conditions": [
        {"type": "signal_match", "signal_pattern": "*三买*"}
      ]
    },
    "exit_rules": {
      "operator": "OR",
      "conditions": [
        {"type": "signal_match", "signal_pattern": "*三卖*"},
        {"type": "stop_loss", "value": -0.03}
      ]
    }
  }'

# 获取策略详情
curl http://localhost:8000/api/v1/strategy/my_first_strategy

# 获取策略列表
curl http://localhost:8000/api/v1/strategy/list?author=trader001&limit=20

# 更新策略
curl -X PUT http://localhost:8000/api/v1/strategy/my_first_strategy \
  -H "Content-Type: application/json" \
  -d '{
    "description": "更新后的描述",
    "is_active": true
  }'

# 删除策略
curl -X DELETE http://localhost:8000/api/v1/strategy/my_first_strategy

# 获取策略回测历史
curl http://localhost:8000/api/v1/strategy/my_first_strategy/backtests?limit=10
```

---

## 10. 更新日志

### v1.2.0 (2025-10-11)
- ✅ 统计字段全部改为英文（API规范化）
- ✅ 支持多种时间格式（ISO 8601, Z后缀）
- ✅ 策略删除改为软删除（默认）
- ✅ 添加 `/api/v1/backtest/signal` 专用路由

### v1.1.0 (2025-10-11)
- ✅ 实现策略管理接口（CRUD）
- ✅ 支持从模板创建策略
- ✅ 内置5个策略模板
- ✅ 策略与回测关联
- ✅ 支持JSON配置策略

### v1.0.0 (2025-10-10)
- ✅ 实现信号回测接口
- ✅ 实现权重回测接口
- ✅ 实现K线分析接口
- ✅ 自动信号存储
- ✅ 回测结果数据库存储
- ✅ 支持买卖点信号识别

---

## 11. 联系支持

- 项目文档: https://s0cqcxuy3p.feishu.cn/wiki/wikcn3gB1MKl3ClpLnboHM1QgKf
- 技术支持: zeng_bin8888@163.com
