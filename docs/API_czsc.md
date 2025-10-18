# CZSC API 参考文档

**Base URL**: `http://localhost:8000`

---

## 接口列表

### 1. K线分析

#### 1.1 分析K线
- **POST** `/api/v1/analyze`
- 分析指定标的的K线数据，生成缠论信号

**请求**:
```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_time": "2025-10-01T00:00:00",
  "end_time": "2025-10-10T00:00:00"
}
```

---

### 2. 信号查询

#### 2.1 查询历史信号
- **GET** `/api/v1/signals/query?symbol=BTCUSDT&freq=15m&limit=100`
- **POST** `/api/v1/signals/query`

**POST请求体**:
```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_time": "2025-10-01T00:00:00",
  "end_time": "2025-10-10T23:59:59",
  "signal_names": ["15分钟_D1_分型"],
  "limit": 100
}
```

#### 2.2 信号汇总
- **GET** `/api/v1/signals/summary?symbol=BTCUSDT&freq=15m`
- 获取最新信号时间、累计数量、有效信号列表

---

### 3. 回测

#### 3.1 Simple 回测（权重回测）
- **POST** `/api/v1/backtest`
- 快速验证信号，基于权重连续调仓

**请求**:
```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-09-01T00:00:00",
  "end_date": "2025-10-10T23:59:59",
  "strategy": {
    "signal_names": ["czsc.signals.cxt.cxt_bi_base_V230228"],
    "weight_method": "mean",
    "fee_rate": 0.0002
  }
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "task_id": "20251013151203_BTCUSDT_15m",
    "stats": {
      "年化": 0.6349,
      "夏普": 3.3,
      "最大回撤": 0.0718,
      "交易胜率": 0.5588
    },
    "equity_curve": [...],
    "trades_count": 41
  }
}
```

#### 3.2 CZSC 回测（Position 策略）
- **POST** `/api/v1/backtest/czsc`
- 完整策略回测，返回交易明细，可用于实盘

**方式1 - 使用策略ID**:
```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-09-01T00:00:00",
  "end_date": "2025-10-10T23:59:59",
  "strategy_id": "bi_direction_strategy_001"
}
```

**方式2 - 直接传入配置**:
```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-09-01T00:00:00",
  "end_date": "2025-10-10T23:59:59",
  "positions_config": [{
    "name": "笔方向策略",
    "symbol": "BTCUSDT",
    "opens": [{
      "operate": "LO",
      "factors": [{
        "signals_all": ["15m_D0BL9_V230228_向上_任意_任意_0"]
      }]
    }],
    "exits": [{
      "operate": "LE",
      "factors": [{
        "signals_all": ["15m_D0BL9_V230228_向下_任意_任意_0"]
      }]
    }],
    "interval": 0,
    "timeout": 100,
    "stop_loss": 200,
    "T0": false
  }],
  "signals_config": [{
    "name": "czsc.signals.cxt.cxt_bi_base_V230228",
    "freq": "15m",
    "bi_init_length": 9
  }],
  "fee_rate": 0.001
}
```

**Position 配置字段**:
- `interval`: 开仓间隔（K线数），0表示无限制
- `timeout`: 超时平仓（K线数），持仓超过该时间自动平仓
- `stop_loss`: 止损（BP），1BP=0.01%，200表示2%止损
- `T0`: 是否支持T+0交易，股票通常为false

**操作码说明**:
- `LO`: 开多仓（Long Open）
- `LE`: 平多仓（Long Exit）
- `SO`: 开空仓（Short Open）
- `SE`: 平空仓（Short Exit）

**响应**:
```json
{
  "code": 200,
  "data": {
    "task_id": "20251013151203_BTCUSDT_15m_czsc",
    "stats": {
      "年化": 0.6349,
      "夏普": 3.3,
      "最大回撤": 0.0718,
      "交易胜率": 0.5588,
      "单笔收益": 30.55
    },
    "equity_curve": [...],
    "trades": [
      {
        "标的代码": "BTCUSDT",
        "交易方向": "多头",
        "开仓时间": "2025-09-05T10:00:00",
        "平仓时间": "2025-09-05T14:30:00",
        "开仓价格": 50000.0,
        "平仓价格": 50500.0,
        "盈亏比例": 100.0,
        "持仓K线数": 18,
        "持仓天数": 0.19
      }
    ],
    "trades_count": 36
  }
}
```

#### 3.3 查询回测列表
- **GET** `/api/v1/backtest/list?symbol=BTCUSDT&limit=20`

#### 3.4 回测详情
- **GET** `/api/v1/backtest/{task_id}`
- 获取指定任务的完整回测结果，包含交易明细

**请求**:
```bash
GET /api/v1/backtest/20251015133933_BTCUSDT_15m_czsc
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 73,
    "task_id": "20251015133933_BTCUSDT_15m_czsc",
    "symbol": "BTCUSDT",
    "freq": "15m",
    "start_date": "2025-09-15T05:20:22",
    "end_date": "2025-10-15T05:20:22",
    "created_at": "2025-10-15T13:39:41",

    // ===== 英文字段（用于数据库查询、排序、筛选） =====
    "total_return": -0.0441,
    "annual_return": -0.463,
    "max_drawdown": 0.1333,
    "sharpe_ratio": -1.21,
    "calmar_ratio": -3.47,
    "win_rate": 0.5217,
    "total_trades": 0,
    "avg_holding_bars": 79.91,
    // ... 其他统计字段

    // ===== stats_data（CZSC完整输出 + 资金信息） =====
    "stats_data": {
      // 资金信息（新增）
      "初始资金": 100000.0,
      "最终资金": 95559.09,
      "盈亏金额": -4440.91,
      "总收益率": -0.0444,

      // CZSC 性能指标
      "年化": -0.463,
      "夏普": -1.21,
      "卡玛": -3.47,
      "最大回撤": 0.1333,
      "交易胜率": 0.5217,
      "单笔收益": -11.46,
      "日胜率": 0.4583,
      "持仓K线数": 79.91,
      "持仓天数": 0.09,
      "年化波动率": 0.3826,
      "盈亏平衡点": 1.0,
      // ... 其他30+个指标
    },

    // ===== equity_curve（权益曲线，完整） =====
    "equity_curve": [
      {
        "dt": "2025-09-20",
        "equity": 99930.0,      // 权益值
        "returns": 0.9993,      // 累计收益率
        "price": 0              // 保留字段
      },
      {
        "dt": "2025-09-21",
        "equity": 97221.897,
        "returns": 0.97221897,
        "price": 0
      }
      // ... 完整的每日权益数据
    ],

    // ===== trades_data（交易明细，完整） =====
    "trades_data": [
      {
        "标的代码": "BTCUSDT",
        "策略标记": "position_strategy_1",
        "交易方向": "多头",
        "开仓时间": "2025-09-20T14:30:00",  // 具体时间点
        "平仓时间": "2025-09-22T10:15:00",  // 具体时间点
        "开仓价格": 63500.0,
        "平仓价格": 64200.0,
        "持仓K线数": 124,
        "持仓天数": 1.82,
        "盈亏比例": 0.011,
        "事件序列": "开多_止盈"
      }
      // ... 完整的交易明细
    ]
  }
}
```

**数据结构说明**:

1. **英文字段** (`total_return`, `sharpe_ratio` 等)
   - 用途：数据库索引、SQL查询、排序、筛选
   - 示例：`SELECT * FROM backtest_results WHERE sharpe_ratio > 1.0 ORDER BY total_return DESC`

2. **stats_data** (JSON格式)
   - 用途：CZSC完整统计输出（30+个中文指标）+ 资金信息
   - 特点：包含所有原始指标，适合详细分析
   - 新增字段：
     - `初始资金`: 回测起始资金（默认100000）
     - `最终资金`: 回测结束后的权益
     - `盈亏金额`: 最终资金 - 初始资金
     - `总收益率`: 盈亏金额 / 初始资金

3. **equity_curve** (数组)
   - 用途：绘制权益曲线图
   - 数据：每日的权益值和累计收益率
   - 长度：完整时间序列（从start_date到end_date）

4. **trades_data** (数组)
   - 用途：交易明细分析、交易日志
   - 数据：每笔交易的开仓/平仓时间、价格、盈亏
   - 特点：**包含具体时间点**（精确到分钟/秒）
   - 注意：这是 Position 的交易对（开平配对），不是每日收益

**重要提示**:
- 列表接口 `/api/v1/backtest/list` **不返回** `equity_curve` 和 `trades_data`（减少响应大小）
- 详情接口 `/api/v1/backtest/{task_id}` **返回完整数据**，包括所有交易明细

---

### 4. 策略管理（Position 策略）

#### 4.1 创建策略
- **POST** `/api/v1/strategy`

**请求**:
```json
{
  "strategy_id": "bi_direction_strategy_001",
  "name": "笔方向多空策略",
  "description": "基于笔方向的多空双向交易策略",
  "category": "trend",
  "positions_config": [{
    "name": "笔方向策略",
    "symbol": "BTCUSDT",
    "opens": [
      {
        "operate": "LO",
        "factors": [{
          "name": "向上笔",
          "signals_all": ["15m_D0BL9_V230228_向上_任意_任意_0"]
        }]
      },
      {
        "operate": "SO",
        "factors": [{
          "name": "向下笔",
          "signals_all": ["15m_D0BL9_V230228_向下_任意_任意_0"]
        }]
      }
    ],
    "exits": [
      {
        "operate": "LE",
        "factors": [{
          "signals_all": ["15m_D0BL9_V230228_向下_任意_任意_0"]
        }]
      },
      {
        "operate": "SE",
        "factors": [{
          "signals_all": ["15m_D0BL9_V230228_向上_任意_任意_0"]
        }]
      }
    ],
    "interval": 0,
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
  "author": "测试用户",
  "tags": ["trend", "bi_direction"]
}
```

**响应**:
```json
{
  "code": 200,
  "message": "Strategy bi_direction_strategy_001 created successfully",
  "data": {
    "strategy_id": "bi_direction_strategy_001"
  }
}
```

#### 4.2 策略列表
- **GET** `/api/v1/strategy/list?limit=20&category=trend&author=测试用户`

**响应**:
```json
{
  "code": 200,
  "data": {
    "total": 5,
    "strategies": [
      {
        "strategy_id": "bi_direction_strategy_001",
        "name": "笔方向多空策略",
        "category": "trend",
        "version": "1.0.0",
        "author": "测试用户",
        "use_count": 10,
        "avg_return": 0.0635,
        "avg_sharpe": 3.25,
        "is_active": true,
        "created_at": "2025-10-13T10:00:00"
      }
    ]
  }
}
```

#### 4.3 策略详情
- **GET** `/api/v1/strategy/{strategy_id}`

**响应**:
```json
{
  "code": 200,
  "data": {
    "strategy_id": "bi_direction_strategy_001",
    "name": "笔方向多空策略",
    "description": "基于笔方向的多空双向交易策略",
    "category": "trend",
    "positions_config": [...],
    "signals_config": [...],
    "ensemble_method": "mean",
    "fee_rate": 0.001,
    "version": "1.0.0",
    "author": "测试用户",
    "tags": ["trend", "bi_direction"],
    "use_count": 10,
    "avg_return": 0.0635,
    "avg_sharpe": 3.25,
    "is_active": true,
    "created_at": "2025-10-13T10:00:00",
    "updated_at": "2025-10-13T12:00:00"
  }
}
```

#### 4.4 更新策略
- **PUT** `/api/v1/strategy/{strategy_id}`

**请求**:
```json
{
  "name": "新策略名称",
  "description": "更新后的描述",
  "is_active": false
}
```

#### 4.5 删除策略
- **DELETE** `/api/v1/strategy/{strategy_id}?hard_delete=false`
  - `hard_delete=false`: 软删除（默认，设置为不活跃）
  - `hard_delete=true`: 硬删除（物理删除数据）

---

## 回测对比

| 特性 | Simple 回测 | CZSC 回测 |
|-----|------------|-----------|
| 接口 | `/api/v1/backtest` | `/api/v1/backtest/czsc` |
| 用途 | 快速验证信号 | 完整策略回测 |
| 交易方式 | 连续权重调仓 | 离散开平仓 |
| 交易明细 | ❌ 无 | ✅ 有 trades |
| 风控 | 基础 | 完整（止损/超时/间隔） |
| 多空 | ❌ 单向 | ✅ 双向 |
| 策略管理 | ❌ 无 | ✅ 支持保存和复用 |
| 实盘转化 | ❌ 不能 | ✅ 可以 |

---

## Factor 信号组合逻辑

Factor 用于组合多个信号，支持三种逻辑：

- **signals_all**: 所有信号必须同时满足（AND 逻辑）
- **signals_any**: 任意信号满足即可（OR 逻辑）
- **signals_not**: 不能出现的信号（NOT 逻辑）

**示例**:
```json
{
  "factors": [{
    "name": "MACD金叉+笔向上",
    "signals_all": [
      "15m_MACD_金叉_任意_任意_0",
      "15m_D0BL9_V230228_向上_任意_任意_0"
    ],
    "signals_not": [
      "15m_VOL_缩量_任意_任意_0"
    ]
  }]
}
```

---

## 统计字段说明

### 核心性能指标

| 中文字段 | 英文字段 | 说明 | 单位/范围 |
|---------|---------|------|----------|
| `年化` | `annual_return` | 年化收益率 | 小数（-1 ~ +∞） |
| `夏普` | `sharpe_ratio` | 夏普比率（收益/波动） | 数值（>1优秀） |
| `卡玛` | `calmar_ratio` | 卡玛比率（收益/回撤） | 数值（>3优秀） |
| `索提诺` | `sortino_ratio` | 索提诺比率（下行风险） | 数值 |
| `最大回撤` | `max_drawdown` | 最大回撤 | 小数（0 ~ -1） |
| `年化波动率` | `volatility` | 年化波动率 | 小数 |

### 资金相关（新增）

| 中文字段 | 说明 | 示例 |
|---------|------|------|
| `初始资金` | 回测起始资金 | 100000.0 |
| `最终资金` | 回测结束后的权益 | 95559.09 |
| `盈亏金额` | 最终资金 - 初始资金 | -4440.91 |
| `总收益率` | 盈亏金额 / 初始资金 | -0.0444 |
| `绝对收益` | CZSC计算的累计收益率 | -0.0441 |

### 交易统计

| 中文字段 | 英文字段 | 说明 | 单位 |
|---------|---------|------|------|
| `交易胜率` | `win_rate` | 盈利交易占比 | 小数（0~1） |
| `日胜率` | `avg_profit` | 日收益率均值 | 小数 |
| `单笔收益` | `single_trade_return` | 平均每笔收益 | BP (1BP=0.01%) |
| `持仓天数` | - | 平均持仓时间 | 天 |
| `持仓K线数` | `avg_holding_bars` | 平均持仓K线数 | 根 |
| `盈亏平衡点` | `break_even_point` | 盈亏平衡胜率 | 小数（0~1） |

### 持仓分布

| 中文字段 | 说明 | 单位 |
|---------|------|------|
| `多头占比` | 多头持仓时间占比 | 小数（0~1） |
| `空头占比` | 空头持仓时间占比 | 小数（0~1） |
| `非零覆盖` | 持仓时间占比 | 小数（0~1） |

### 数据映射关系

**英文字段 ↔ 中文字段映射**:
```python
{
    'total_return': '绝对收益',
    'annual_return': '年化',
    'win_rate': '交易胜率',
    'sharpe_ratio': '夏普',
    'calmar_ratio': '卡玛',
    'max_drawdown': '最大回撤',
    'volatility': '年化波动率',
    'avg_holding_bars': '持仓K线数',
    'single_trade_return': '单笔收益',
    'break_even_point': '盈亏平衡点'
}
```

**注意事项**:
1. 英文字段用于数据库查询和SQL操作
2. 中文字段保留在 `stats_data` 中，包含CZSC完整输出
3. 资金信息（初始资金、最终资金等）是从 `equity_curve` 计算得出
4. 部分字段可能为0或null（如 `total_trades`），因为CZSC不返回这些数据

---

## 信号名称格式

CZSC 信号名称格式：`{周期}_{信号函数}_{参数}_{状态}`

**示例**:
- `15m_D0BL9_V230228_向上_任意_任意_0` - 15分钟周期笔向上信号
- `15m_D0BL9_V230228_向下_任意_任意_0` - 15分钟周期笔向下信号
- `60m_MACD_金叉_任意_任意_0` - 60分钟MACD金叉

**前端传参注意**:
- 前端可以使用英文格式：`15m`, `60m`, `1h`, `1d`
- API 自动转换为中文格式：`15分钟`, `60分钟`, `日线`
- 信号名称中的周期前缀也会自动转换

---

## 响应格式

成功响应:
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

错误响应:
```json
{
  "detail": "错误信息"
}
```

---

## 时间格式

支持以下格式:
- `2025-10-01T00:00:00`
- `2025-10-01T00:00:00.000Z`
- `2025-10-01T00:00:00+08:00`

---

## 快速开始

### 1. 创建策略
```bash
curl -X POST http://localhost:8000/api/v1/strategy \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": "my_first_strategy",
    "name": "我的第一个策略",
    "category": "trend",
    "positions_config": [{
      "name": "简单多头",
      "opens": [{"operate": "LO", "factors": [{"signals_all": ["15m_D0BL9_V230228_向上_任意_任意_0"]}]}],
      "exits": [{"operate": "LE", "factors": [{"signals_all": ["15m_D0BL9_V230228_向下_任意_任意_0"]}]}],
      "interval": 0,
      "timeout": 100,
      "stop_loss": 200,
      "T0": false
    }],
    "signals_config": [{"name": "czsc.signals.cxt.cxt_bi_base_V230228", "freq": "15m"}]
  }'
```

### 2. 使用策略回测
```bash
curl -X POST http://localhost:8000/api/v1/backtest/czsc \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "freq": "15m",
    "start_date": "2025-09-01T00:00:00",
    "end_date": "2025-10-01T00:00:00",
    "strategy_id": "my_first_strategy"
  }'
```

### 3. 查询策略列表
```bash
curl "http://localhost:8000/api/v1/strategy/list?limit=10"
```

### 4. 查询回测结果
```bash
curl "http://localhost:8000/api/v1/backtest/list?limit=10"
```

---

## 常见问题

### Q: 信号名称格式不匹配？
**A**: 前端传英文格式（如 `15m`），API 自动转换为中文格式（`15分钟`）。信号名称中的周期前缀也会自动转换。

### Q: 策略回测返回交易数为0？
**A**: 检查：
1. 信号名称格式是否正确（必须是7段格式）
2. Factor 逻辑是否合理（signals_all/any/not配置）
3. 回测时间段是否有对应的信号触发
4. Position配置的 interval、timeout、stop_loss 是否过于严格

### Q: Simple vs CZSC 回测如何选择？
**A**:
- **Simple 回测** (`/api/v1/backtest`):
  - 快速验证信号有效性
  - 连续权重调仓，无交易明细
  - 适合初步筛选信号

- **CZSC 回测** (`/api/v1/backtest/czsc`):
  - 完整策略回测，有交易明细
  - 支持止损/止盈/超时控制
  - 可用于实盘转化

### Q: 如何实现多空双向交易？
**A**: 在 `opens` 中同时配置 `LO`（开多）和 `SO`（开空），在 `exits` 中配置 `LE`（平多）和 `SE`（平空）。

### Q: 为什么回测结果中某些字段为0？
**A**:
1. **英文字段为0** (如 `total_return: 0`)：
   - 原因：中英文字段映射问题
   - 解决：已修复，新的回测不会出现此问题
   - 参考：`stats_data` 中的中文字段有正确的值

2. **部分统计字段为0** (如 `total_trades: 0`)：
   - 原因：CZSC不返回该字段
   - 说明：这是正常的，某些字段CZSC确实不计算

### Q: trades_data 没有开仓/平仓时间？
**A**:
- **旧数据**：可能保存的是每日收益（dailys），而不是交易明细
- **新数据**：已修复，`trades_data` 现在包含完整的交易明细，包括：
  - `开仓时间`: 精确到分钟/秒
  - `平仓时间`: 精确到分钟/秒
  - `开仓价格`、`平仓价格`、`盈亏比例` 等

### Q: 如何获取初始资金、最终资金等信息？
**A**:
- 从 `stats_data` 中获取（v20251015后新增）：
  ```json
  {
    "初始资金": 100000.0,
    "最终资金": 95559.09,
    "盈亏金额": -4440.91,
    "总收益率": -0.0444
  }
  ```
- 或从 `equity_curve` 手动计算：
  ```python
  initial = 100000.0
  final = equity_curve[-1]['equity']
  profit = final - initial
  ```

### Q: 英文字段和stats_data有什么区别？
**A**:
1. **英文字段** (`total_return`, `sharpe_ratio` 等)
   - 用于数据库查询、排序、筛选
   - 示例：`WHERE sharpe_ratio > 1.0 ORDER BY total_return DESC`

2. **stats_data** (JSON格式)
   - CZSC完整输出（30+个中文指标）
   - 包含所有原始数据，适合详细分析
   - 新增资金信息（初始资金、最终资金等）

### Q: 如何理解 trades_data 和 equity_curve？
**A**:
- **trades_data**: 交易明细（离散的开平仓对）
  - 用途：分析每笔交易的盈亏、持仓时间
  - 示例：第3笔交易，2025-09-20开多，2025-09-22平仓，盈利1.1%

- **equity_curve**: 权益曲线（连续的每日权益）
  - 用途：绘制权益曲线图、计算最大回撤
  - 示例：2025-09-20权益99930，2025-09-21权益97221...
