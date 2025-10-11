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
  "sdt": "2025-10-01T00:00:00",
  "edt": "2025-10-10T00:00:00"
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

#### 3.1 信号回测
- **POST** `/api/v1/backtest/signal`

**请求**:
```json
{
  "symbol": "BTCUSDT",
  "freq": "15m",
  "start_date": "2025-10-01T00:00:00",
  "end_date": "2025-10-10T00:00:00",
  "signal_config": {
    "signal_names": ["cxt_third_bs_V230318"],
    "fee_rate": 0.0002,
    "initial_cash": 100000
  }
}
```

#### 3.2 查询回测列表
- **GET** `/api/v1/backtest/list?symbol=BTCUSDT&limit=20`

#### 3.3 回测详情
- **GET** `/api/v1/backtest/{task_id}`

---

### 4. 策略管理

#### 4.1 创建策略
- **POST** `/api/v1/strategy`

**请求**:
```json
{
  "strategy_id": "my_strategy_001",
  "name": "我的策略",
  "signals": [{"name": "cxt_third_bs_V230318", "freq": "15分钟"}],
  "entry_rules": {
    "operator": "OR",
    "conditions": [{"type": "signal_match", "signal_pattern": "*三买*"}]
  },
  "exit_rules": {
    "operator": "OR",
    "conditions": [
      {"type": "signal_match", "signal_pattern": "*三卖*"},
      {"type": "stop_loss", "value": -0.03}
    ]
  }
}
```

#### 4.2 策略列表
- **GET** `/api/v1/strategy/list?limit=20`

#### 4.3 策略详情
- **GET** `/api/v1/strategy/{strategy_id}`

#### 4.4 更新策略
- **PUT** `/api/v1/strategy/{strategy_id}`

#### 4.5 删除策略（软删除）
- **DELETE** `/api/v1/strategy/{strategy_id}?hard_delete=false`

#### 4.6 策略回测历史
- **GET** `/api/v1/strategy/{strategy_id}/backtests`

#### 4.7 模板列表
- **GET** `/api/v1/strategy/template/list`

#### 4.8 从模板创建
- **POST** `/api/v1/strategy/from_template`

---

## 统计字段说明

| 字段 | 说明 |
|-----|------|
| `total_return` | 总收益率 |
| `annual_return` | 年化收益率 |
| `max_drawdown` | 最大回撤 |
| `sharpe_ratio` | 夏普比率 |
| `total_trades` | 交易次数 |
| `win_rate` | 胜率 |
| `avg_profit` | 平均盈利 |
| `avg_loss` | 平均亏损 |

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

```bash
# 查询信号
curl "http://localhost:8000/api/v1/signals/query?symbol=BTCUSDT&freq=15m&limit=10"

# 获取信号汇总
curl "http://localhost:8000/api/v1/signals/summary?symbol=BTCUSDT&freq=15m"

# 执行回测
curl -X POST http://localhost:8000/api/v1/backtest/signal \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "freq": "15m",
    "start_date": "2025-10-01T00:00:00",
    "end_date": "2025-10-10T00:00:00",
    "signal_config": {
      "signal_names": ["cxt_third_bs_V230318"],
      "fee_rate": 0.0002
    }
  }'

# 查询回测列表
curl "http://localhost:8000/api/v1/backtest/list?limit=10"

# 策略列表
curl "http://localhost:8000/api/v1/strategy/list"

# 模板列表
curl "http://localhost:8000/api/v1/strategy/template/list"
```
