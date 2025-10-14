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

| 字段 | 说明 | 单位 |
|-----|------|------|
| `年化` / `年化收益率` | 年化收益率 | 小数 |
| `夏普` / `夏普比率` | 夏普比率 | 数值 |
| `最大回撤` | 最大回撤 | 小数 |
| `卡玛` / `卡玛比率` | 卡玛比率 | 数值 |
| `交易胜率` | 盈利交易占比 | 小数 |
| `单笔收益` | 平均每笔收益 | BP (1BP=0.01%) |
| `盈亏比` / `盈亏比例` | 单笔盈亏 | BP |
| `持仓天数` | 平均持仓时间 | 天 |
| `持仓K线数` | 持仓K线数量 | 根 |

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
A: 前端传英文格式（如 `15m`），API 自动转换为中文格式（`15分钟`）。信号名称中的周期前缀也会自动转换。

### Q: 策略回测返回交易数为0？
A: 检查：
1. 信号名称格式是否正确
2. Factor 逻辑是否合理
3. 回测时间段是否有对应的信号触发

### Q: Simple vs CZSC 回测如何选择？
A:
- **Simple**: 快速验证信号有效性，不需要交易明细
- **CZSC**: 完整策略回测，需要交易明细，可用于实盘

### Q: 如何实现多空双向交易？
A: 在 `opens` 中同时配置 `LO`（开多）和 `SO`（开空），在 `exits` 中配置 `LE`（平多）和 `SE`（平空）。
