# Trading Master 前端 - 双服务器API架构文档

## 📋 架构概述

后端系统已重构为两个独立服务，前端需要同时对接两个API服务器：

```
前端应用
├── K线数据服务 (http://45.249.246.109:3000)
│   ├── K线数据拉取和存储
│   ├── 市场数据实时监控
│   ├── 币种配置管理
│   ├── 持仓量(OI)监控
│   └── 系统监控
│
└── CZSC回测系统 (http://localhost:8000)
    ├── K线数据分析（生成缠论信号）
    ├── 策略管理（CRUD）
    ├── 回测执行和结果查询
    └── 策略模板管理
```

---

## 🔧 API客户端配置

### 1. K线数据服务客户端 (`apiClient.ts`)

**Base URL**: `http://45.249.246.109:3000`
**环境变量**: `VITE_API_URL`
**超时时间**: 10秒

**负责的功能模块**:
- ✅ K线数据获取 (`klineAPI`)
- ✅ 币种配置管理 (`symbolConfigAPI`)
- ✅ 市场数据 (`marketAPI`)
- ✅ 持仓量监控 (`oiAPI`)
- ✅ 历史数据 (`historicalAPI`)
- ✅ 系统监控 (`monitoringAPI`)
- ✅ 交易信号 (`signalAPI`) - 传统技术指标信号
- ✅ 结构检测 (`structureAPI`) - 支撑阻力位检测
- ✅ 缠论分析 (`chanAPI`) - 旧接口（标记为待迁移）

### 2. CZSC回测系统客户端 (`czscApiClient.ts`)

**Base URL**: `http://localhost:8000`
**环境变量**: `VITE_CZSC_API_URL`
**超时时间**: 30秒（回测耗时较长）

**负责的功能模块**:
- ✅ K线分析 (`czscAnalyzeAPI`) - 生成缠论信号
- ✅ 策略管理 (`czscStrategyAPI`) - 策略CRUD和模板
- ✅ 回测执行 (`czscBacktestAPI`) - 信号回测和结果查询

---

## 📁 文件结构

```
src/services/
├── apiClient.ts              # K线数据服务客户端（主服务器）
├── czscApiClient.ts          # CZSC回测系统客户端（新增）
│
├── klineAPI.ts               # K线数据API (:3000)
├── symbolConfigAPI.ts        # 币种配置API (:3000)
├── marketAPI.ts              # 市场数据API (:3000)
├── oiAPI.ts                  # 持仓量API (:3000)
├── historicalAPI.ts          # 历史数据API (:3000)
├── monitoringAPI.ts          # 系统监控API (:3000)
├── signalAPI.ts              # 技术指标信号API (:3000)
├── structureAPI.ts           # 结构检测API (:3000)
├── chanAPI.ts                # 缠论分析API (:3000) - 待迁移
│
├── czscAnalyzeAPI.ts         # CZSC K线分析API (:8000) 🆕
├── czscStrategyAPI.ts        # CZSC 策略管理API (:8000) 🆕
├── czscBacktestAPI.ts        # CZSC 回测API (:8000) 🆕
│
└── index.ts                  # 统一导出
```

---

## 🌐 环境变量配置

### .env.example 模板

```env
# K线数据服务
VITE_API_URL=http://45.249.246.109:3000
VITE_WS_URL=ws://45.249.246.109:3000

# CZSC回测系统
VITE_CZSC_API_URL=http://localhost:8000

# 功能开关
VITE_ENABLE_CZSC=true
```

### 开发环境 (.env.local)

```env
VITE_API_URL=http://45.249.246.109:3000
VITE_CZSC_API_URL=http://localhost:8000
VITE_ENABLE_CZSC=true
```

### 生产环境 (.env.production)

```env
VITE_API_URL=https://api.tradingmaster.com
VITE_CZSC_API_URL=https://czsc.tradingmaster.com
VITE_ENABLE_CZSC=true
```

---

## 📊 接口分类详情

### K线数据服务接口 (:3000)

#### 1. K线数据 (`klineAPI.ts`)
```typescript
import { klineAPI } from '@/services';

// 获取K线数据
const klines = await klineAPI.getKlines('BTCUSDT', '1h', 300);

// 获取最新K线
const latest = await klineAPI.getLatestKlines('BTCUSDT', '1h', 100);
```

#### 2. 币种配置 (`symbolConfigAPI.ts`)
```typescript
import { symbolConfigAPI } from '@/services';

// 获取所有币种配置
const symbols = await symbolConfigAPI.getAllSymbols();
```

#### 3. 市场数据 (`marketAPI.ts`)
```typescript
import { marketAPI } from '@/services';

// 获取市场概览
const overview = await marketAPI.getMarketOverview();
```

#### 4. 持仓量监控 (`oiAPI.ts`)
```typescript
import { oiAPI } from '@/services';

// 获取OI统计数据
const stats = await oiAPI.getOIStatistics();

// 获取异常数据
const anomalies = await oiAPI.getRecentAnomalies();
```

---

### CZSC回测系统接口 (:8000)

#### 1. K线分析 (`czscAnalyzeAPI.ts`)
```typescript
import { czscAnalyzeAPI } from '@/services';

// 分析K线数据，生成缠论信号
const result = await czscAnalyzeAPI.analyzeKline({
  symbol: 'BTCUSDT',
  freq: '15m',
  sdt: '2025-10-01T00:00:00',
  edt: '2025-10-10T00:00:00',
  limit: 1000
});

console.log(result.bi_list);      // 笔的列表
console.log(result.signals);      // 每根K线的信号详情
```

#### 2. 策略管理 (`czscStrategyAPI.ts`)
```typescript
import { czscStrategyAPI } from '@/services';

// 从模板创建策略
const result = await czscStrategyAPI.createFromTemplate({
  template_id: 'template_simple_bs',
  strategy_id: 'my_first_strategy',
  name: '我的第一个策略',
  author: 'trader001'
});

// 获取策略列表
const strategies = await czscStrategyAPI.getStrategyList({ limit: 20 });

// 获取策略详情
const strategy = await czscStrategyAPI.getStrategy('my_first_strategy');

// 获取模板列表
const templates = await czscStrategyAPI.getTemplateList();
```

#### 3. 回测执行 (`czscBacktestAPI.ts`)
```typescript
import { czscBacktestAPI } from '@/services';

// 运行信号回测
const result = await czscBacktestAPI.runSignalBacktest({
  symbol: 'BTCUSDT',
  freq: '15m',
  start_date: '2025-10-01T00:00:00',
  end_date: '2025-10-10T00:00:00',
  signal_config: {
    signal_names: ['cxt_third_bs_V230318', 'tas_first_bs_V230217'],
    fee_rate: 0.0002,
    initial_cash: 100000
  }
});

console.log(result.stats);        // 回测统计数据
console.log(result.trades);       // 交易明细
console.log(result.equity_curve); // 权益曲线

// 查询回测列表
const list = await czscBacktestAPI.getBacktestList({ symbol: 'BTCUSDT', limit: 10 });

// 获取回测详情
const detail = await czscBacktestAPI.getBacktestDetail(result.task_id);
```

---

## 🔄 迁移指南

### 旧代码迁移

#### 场景1：从旧量化回测迁移到CZSC

**旧代码** (使用旧的量化回测API):
```typescript
import { backtestAPI } from '@/quantitative/services';

const result = await backtestAPI.runBacktest({
  strategy_id: 1,
  symbol: 'BTCUSDT',
  interval: '15m',
  start_date: '2025-10-01',
  end_date: '2025-10-10'
});
```

**新代码** (使用CZSC回测API):
```typescript
import { czscBacktestAPI } from '@/services';

const result = await czscBacktestAPI.runSignalBacktest({
  symbol: 'BTCUSDT',
  freq: '15m',
  start_date: '2025-10-01T00:00:00',
  end_date: '2025-10-10T00:00:00',
  signal_config: {
    signal_names: ['cxt_third_bs_V230318'],
    fee_rate: 0.0002,
    initial_cash: 100000
  }
});
```

#### 场景2：缠论分析迁移

**旧代码** (使用旧的chanAPI):
```typescript
import { chanAPI } from '@/services';

const analysis = await chanAPI.getChanAnalysis({
  symbol: 'BTCUSDT',
  interval: '15m',
  lookback: 200
});
```

**新代码** (使用CZSC分析API):
```typescript
import { czscAnalyzeAPI } from '@/services';

const analysis = await czscAnalyzeAPI.analyzeKline({
  symbol: 'BTCUSDT',
  freq: '15m',
  limit: 1000
});
```

---

## 🚨 注意事项

### 1. API响应格式差异

**K线数据服务** (apiClient):
- 自动解包 `data` 字段
- 响应格式: `{ success: true, data: [...] }` → 直接返回 `[...]`

**CZSC回测系统** (czscApiClient):
- 不解包，直接返回响应体
- 错误格式: `{ error: "错误类型", message: "详细错误信息" }`

### 2. 时间格式差异

**K线数据服务**:
- 时间戳（毫秒）: `1728000000000`

**CZSC回测系统**:
- ISO 8601字符串: `"2025-10-01T00:00:00"`

### 3. 参数命名差异

| 功能 | K线数据服务 | CZSC回测系统 |
|-----|-----------|------------|
| 时间周期 | `interval` (1h, 15m) | `freq` (1h, 15m) |
| 币种 | `symbol` | `symbol` |
| 开始时间 | `start_time` (毫秒) | `sdt` (ISO字符串) |
| 结束时间 | `end_time` (毫秒) | `edt` (ISO字符串) |

### 4. 超时处理

- **K线数据服务**: 10秒超时，适合快速查询
- **CZSC回测系统**: 30秒超时，回测任务耗时较长

### 5. 错误处理

```typescript
try {
  const result = await czscBacktestAPI.runSignalBacktest(params);
} catch (error) {
  if (error.name === 'CZSCAPIError') {
    console.error('CZSC服务错误:', error.message);
  } else {
    console.error('未知错误:', error);
  }
}
```

---

## 🧪 测试建议

### 1. 本地开发测试

```bash
# 启动K线数据服务（确保运行在 :3000）
cd trading-master-backend
npm run dev

# 启动CZSC回测服务（确保运行在 :8000）
cd czsc-backtest-system
python main.py

# 启动前端
cd trading-master-front
npm run dev
```

### 2. API健康检查

```typescript
// 检查K线数据服务
const healthK = await fetch('http://45.249.246.109:3000/health');
console.log('K线服务状态:', await healthK.json());

// 检查CZSC服务
const healthCZSC = await fetch('http://localhost:8000/health');
console.log('CZSC服务状态:', await healthCZSC.json());
```

### 3. 功能开关

如果CZSC服务未部署，可以通过环境变量禁用相关功能：

```typescript
const isCZSCEnabled = import.meta.env.VITE_ENABLE_CZSC === 'true';

if (isCZSCEnabled) {
  // 显示CZSC相关功能
  <CZSCBacktestPanel />
} else {
  // 显示提示信息
  <Alert message="CZSC功能未启用" />
}
```

---

## 📚 相关文档

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - CZSC回测系统完整API文档
- [CLAUDE.md](../CLAUDE.md) - 项目开发指南
- [.env.example](../.env.example) - 环境变量配置模板

---

## 🔗 快速链接

- K线数据服务Swagger: `http://45.249.246.109:3000/api-docs`
- CZSC回测系统文档: 见 `API_DOCUMENTATION.md`
- 前端开发服务器: `http://localhost:3001`
