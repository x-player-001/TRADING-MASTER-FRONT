# 价格波动分析 API 文档

## 概述

价格波动分析API提供了查询代币价格波动数据的接口，包括价格波动列表、统计信息、最大涨跌幅等功能。

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API文档**: `http://localhost:8000/docs` (Swagger UI)
- **返回格式**: JSON

## API 端点

### 1. 获取价格波动列表

获取价格波动记录，支持多种过滤和排序条件。

**端点**: `GET /api/price-swings`

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码，从1开始 |
| page_size | integer | 否 | 20 | 每页数量，最大100 |
| token_id | string | 否 | - | 代币ID过滤 |
| symbol | string | 否 | - | 代币符号过滤 |
| swing_type | string | 否 | - | 波动类型过滤：rise, fall |
| min_swing_pct | float | 否 | - | 最小波动幅度（百分比） |
| sort_by | string | 否 | start_time | 排序字段：start_time, swing_pct, duration_hours |
| sort_order | string | 否 | desc | 排序方向：asc, desc |

**响应示例**:

```json
{
  "total": 110,
  "page": 1,
  "page_size": 20,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "token_id": "4f3119de-5b53-4f94-9508-e59e47e4f31d",
      "token_symbol": "COAI",
      "token_name": "ChainOpera AI",
      "swing_type": "rise",
      "swing_pct": 19747.54,
      "start_time": "2025-10-13T20:00:00",
      "end_time": "2025-10-17T12:00:00",
      "duration_hours": 88.0,
      "start_price": 1.49052292613713,
      "end_price": 295.832092890584,
      "min_swing_threshold": 50.0,
      "timeframe": "4h",
      "created_at": "2025-10-20T22:24:57.451073"
    }
  ]
}
```

**使用示例**:

```bash
# 获取所有波动记录
curl "http://localhost:8000/api/price-swings?page=1&page_size=20"

# 获取COAI代币的波动记录
curl "http://localhost:8000/api/price-swings?symbol=COAI"

# 获取所有上涨记录
curl "http://localhost:8000/api/price-swings?swing_type=rise"

# 获取涨跌幅大于1000%的记录
curl "http://localhost:8000/api/price-swings?min_swing_pct=1000"

# 按涨跌幅降序排列
curl "http://localhost:8000/api/price-swings?sort_by=swing_pct&sort_order=desc"
```

---

### 2. 获取代币波动统计

获取每个代币的波动统计信息，包括总波动次数、最大涨跌幅等。

**端点**: `GET /api/price-swings/stats`

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码，从1开始 |
| page_size | integer | 否 | 20 | 每页数量，最大100 |
| min_swings | integer | 否 | - | 最小波动次数过滤 |
| min_liquidity | float | 否 | - | 最小流动性（美元） |
| sort_by | string | 否 | total_swings | 排序字段：total_swings, max_rise_pct, max_fall_pct, liquidity_usd |
| sort_order | string | 否 | desc | 排序方向：asc, desc |

**响应示例**:

```json
{
  "total": 15,
  "page": 1,
  "page_size": 20,
  "data": [
    {
      "token_id": "4f3119de-5b53-4f94-9508-e59e47e4f31d",
      "token_symbol": "COAI",
      "token_name": "ChainOpera AI",
      "total_swings": 12,
      "rises": 7,
      "falls": 5,
      "max_rise_pct": 19747.54,
      "max_fall_pct": -98.27,
      "avg_duration_hours": 40.33,
      "current_price": 5.078,
      "liquidity_usd": 2756596.64,
      "market_cap": 997836294.0
    }
  ]
}
```

**使用示例**:

```bash
# 获取所有代币统计
curl "http://localhost:8000/api/price-swings/stats"

# 只显示波动次数>=10的代币
curl "http://localhost:8000/api/price-swings/stats?min_swings=10"

# 只显示流动性>100万的代币
curl "http://localhost:8000/api/price-swings/stats?min_liquidity=1000000"

# 按最大涨幅排序
curl "http://localhost:8000/api/price-swings/stats?sort_by=max_rise_pct&sort_order=desc"
```

---

### 3. 获取最大涨幅 TOP N

获取历史上涨幅最大的价格波动记录。

**端点**: `GET /api/price-swings/top-rises`

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| limit | integer | 否 | 10 | 返回数量，最大100 |

**响应示例**:

```json
[
  {
    "id": "8de02b96-e1a8-4a70-bdf1-d76cb963dc55",
    "token_id": "ccac9ece-5f45-4b6d-a037-48651c59da85",
    "token_symbol": "币安人生",
    "token_name": "币安人生",
    "swing_type": "rise",
    "swing_pct": 50324.02,
    "start_time": "2025-10-04T12:00:00",
    "end_time": "2025-10-08T04:00:00",
    "duration_hours": 88.0,
    "start_price": 0.00103821511725277,
    "end_price": 0.52350978187313,
    "min_swing_threshold": 50.0,
    "timeframe": "4h",
    "created_at": "2025-10-20T22:25:28.936447"
  }
]
```

**使用示例**:

```bash
# 获取TOP 10最大涨幅
curl "http://localhost:8000/api/price-swings/top-rises?limit=10"

# 获取TOP 5最大涨幅
curl "http://localhost:8000/api/price-swings/top-rises?limit=5"
```

---

### 4. 获取最大跌幅 TOP N

获取历史上跌幅最大的价格波动记录。

**端点**: `GET /api/price-swings/top-falls`

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| limit | integer | 否 | 10 | 返回数量，最大100 |

**响应示例**:

```json
[
  {
    "id": "0a12b34c-68c9-4862-b4fb-1feea308d045",
    "token_id": "4f3119de-5b53-4f94-9508-e59e47e4f31d",
    "token_symbol": "COAI",
    "token_name": "ChainOpera AI",
    "swing_type": "fall",
    "swing_pct": -98.27,
    "start_time": "2025-10-17T12:00:00",
    "end_time": "2025-10-20T12:00:00",
    "duration_hours": 72.0,
    "start_price": 295.832092890584,
    "end_price": 5.11099369628482,
    "min_swing_threshold": 50.0,
    "timeframe": "4h",
    "created_at": "2025-10-20T22:24:57.451073"
  }
]
```

**使用示例**:

```bash
# 获取TOP 10最大跌幅
curl "http://localhost:8000/api/price-swings/top-falls?limit=10"

# 获取TOP 5最大跌幅
curl "http://localhost:8000/api/price-swings/top-falls?limit=5"
```

---

## 数据模型

### PriceSwingResponse

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 波动记录ID |
| token_id | string | 代币ID |
| token_symbol | string | 代币符号 |
| token_name | string | 代币名称 |
| swing_type | string | 波动类型：rise 或 fall |
| swing_pct | float | 涨跌幅百分比 |
| start_time | datetime | 起始时间 |
| end_time | datetime | 结束时间 |
| duration_hours | float | 持续时长（小时） |
| start_price | float | 起始价格 |
| end_price | float | 结束价格 |
| min_swing_threshold | float | 分析阈值 |
| timeframe | string | K线周期 |
| created_at | datetime | 创建时间 |

### TokenSwingStats

| 字段 | 类型 | 说明 |
|------|------|------|
| token_id | string | 代币ID |
| token_symbol | string | 代币符号 |
| token_name | string | 代币名称 |
| total_swings | integer | 总波动次数 |
| rises | integer | 上涨次数 |
| falls | integer | 下跌次数 |
| max_rise_pct | float | 最大涨幅(%) |
| max_fall_pct | float | 最大跌幅(%) |
| avg_duration_hours | float | 平均持续时长（小时） |
| current_price | float | 当前价格 |
| liquidity_usd | float | 流动性(USD) |
| market_cap | float | 市值 |

---

## 错误响应

所有API端点在发生错误时都会返回标准错误响应：

```json
{
  "detail": "错误描述信息"
}
```

**常见HTTP状态码**:

- `200 OK`: 请求成功
- `400 Bad Request`: 请求参数错误
- `404 Not Found`: 资源未找到
- `500 Internal Server Error`: 服务器内部错误

---

## Python 客户端示例

```python
import requests

BASE_URL = "http://localhost:8000"

# 1. 获取所有波动记录
response = requests.get(f"{BASE_URL}/api/price-swings", params={
    "page": 1,
    "page_size": 20
})
data = response.json()
print(f"总记录数: {data['total']}")
for swing in data['data']:
    print(f"{swing['token_symbol']}: {swing['swing_type']} {swing['swing_pct']:.2f}%")

# 2. 获取特定代币的波动
response = requests.get(f"{BASE_URL}/api/price-swings", params={
    "symbol": "COAI",
    "page": 1,
    "page_size": 10
})
coai_swings = response.json()
print(f"COAI共有 {coai_swings['total']} 次波动")

# 3. 获取最大涨幅TOP 5
response = requests.get(f"{BASE_URL}/api/price-swings/top-rises", params={
    "limit": 5
})
top_rises = response.json()
for i, swing in enumerate(top_rises, 1):
    print(f"{i}. {swing['token_symbol']}: +{swing['swing_pct']:.2f}%")

# 4. 获取波动统计
response = requests.get(f"{BASE_URL}/api/price-swings/stats", params={
    "min_liquidity": 1000000,  # 流动性>100万
    "sort_by": "total_swings",
    "sort_order": "desc"
})
stats = response.json()
for stat in stats['data']:
    print(f"{stat['token_symbol']}: {stat['total_swings']}次波动, "
          f"最大涨幅{stat['max_rise_pct']:.2f}%, "
          f"最大跌幅{stat['max_fall_pct']:.2f}%")
```

---

## JavaScript/TypeScript 客户端示例

```typescript
const BASE_URL = "http://localhost:8000";

// 1. 获取波动统计
async function getSwingStats() {
  const response = await fetch(
    `${BASE_URL}/api/price-swings/stats?page=1&page_size=10`
  );
  const data = await response.json();

  data.data.forEach(stat => {
    console.log(`${stat.token_symbol}: ${stat.total_swings} swings`);
  });
}

// 2. 获取最大涨幅
async function getTopRises(limit = 10) {
  const response = await fetch(
    `${BASE_URL}/api/price-swings/top-rises?limit=${limit}`
  );
  const rises = await response.json();

  rises.forEach((swing, i) => {
    console.log(
      `${i + 1}. ${swing.token_symbol}: +${swing.swing_pct.toFixed(2)}%`
    );
  });
}

// 3. 筛选大幅上涨（>1000%）
async function getBigRises() {
  const response = await fetch(
    `${BASE_URL}/api/price-swings?swing_type=rise&min_swing_pct=1000`
  );
  const data = await response.json();

  console.log(`找到 ${data.total} 次大幅上涨（>1000%）`);
  return data.data;
}

// 调用示例
getSwingStats();
getTopRises(5);
getBigRises();
```

---

## 使用场景

### 场景1：监控高波动代币

```bash
# 查找波动次数>=10次的代币
curl "http://localhost:8000/api/price-swings/stats?min_swings=10&sort_by=total_swings"
```

### 场景2：分析历史暴涨

```bash
# 查看涨幅>5000%的所有记录
curl "http://localhost:8000/api/price-swings?swing_type=rise&min_swing_pct=5000"
```

### 场景3：风险分析

```bash
# 查看跌幅最大的TOP 10
curl "http://localhost:8000/api/price-swings/top-falls?limit=10"
```

### 场景4：代币深度分析

```bash
# 获取特定代币的所有波动记录
curl "http://localhost:8000/api/price-swings?symbol=COAI&page_size=100"
```

---

## 启动API服务器

```bash
# 开发模式（自动重载）
python3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000 --reload

# 生产模式
python3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

访问 `http://localhost:8000/docs` 查看交互式API文档（Swagger UI）。

---

## 注意事项

1. **分页**: 所有列表接口都支持分页，建议合理设置 `page_size` 避免一次性返回过多数据
2. **过滤**: 支持多条件组合过滤，可以灵活查询所需数据
3. **排序**: 支持按多种字段排序，方便数据分析
4. **性能**: 数据库已建立索引，查询性能良好

---

## 相关文档

- [价格分析模块文档](PRICE_ANALYSIS.md)
- [数据库架构文档](DATABASE_SCHEMA.md)
- [API主文档](../README.md)
