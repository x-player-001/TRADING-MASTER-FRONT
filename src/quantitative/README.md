# 量化交易模块

## 📋 模块概述

完整的量化交易前端模块，对接后端25+个RESTful API接口，提供策略管理、回测分析、交易记录查看、持仓监控、风险管理等功能。

## 🎯 功能特性

- ✅ **策略管理** - 创建、编辑、删除交易策略，支持突破策略和趋势跟踪策略
- ✅ **回测实验室** - 运行策略回测，分析历史表现，查看资金曲线和回撤图表
- ✅ **交易分析** - 查看历史交易记录，统计胜率、盈亏比等指标
- ✅ **持仓监控** - 实时监控持仓状态和未实现盈亏
- ✅ **风险管理** - 配置风控参数，监控风险敞口

## 🚀 快速开始

### 访问量化交易模块

在侧边栏找到**量化交易 🤖**分区，包含6个子页面：

1. **量化仪表板** (`#quant`) - 总览页面
2. **策略管理** (`#quant-strategies`) - 管理交易策略
3. **回测实验室** (`#quant-backtest`) - 运行策略回测
4. **交易分析** (`#quant-trades`) - 查看交易历史
5. **持仓监控** (`#quant-positions`) - 监控持仓状态
6. **风险管理** (`#quant-risk`) - 配置风控参数

### 使用流程

#### 1. 创建策略
```
访问 #quant-strategies → 点击"创建策略" → 填写策略信息 → 保存
```

#### 2. 运行回测
```
访问 #quant-backtest → 选择策略 → 配置回测参数 → 点击"开始回测"
```

#### 3. 查看结果
```
回测完成后自动显示：
- 性能指标（收益率、夏普比率、最大回撤等）
- 资金曲线图
- 回撤曲线图
- 交易明细表
```

## 📁 目录结构

```
src/quantitative/
├── types/              # TypeScript类型定义
│   ├── strategy.ts     # 策略类型
│   ├── backtest.ts     # 回测类型
│   ├── trade.ts        # 交易类型
│   ├── position.ts     # 持仓类型
│   └── risk.ts         # 风险类型
│
├── services/           # API服务层
│   ├── strategyAPI.ts  # 策略API（7个接口）
│   ├── backtestAPI.ts  # 回测API（7个接口）
│   ├── tradeAPI.ts     # 交易API（4个接口）
│   ├── positionAPI.ts  # 持仓API（4个接口）
│   └── riskAPI.ts      # 风险API（4个接口）
│
├── stores/             # 状态管理（Zustand）
│   ├── strategyStore.ts
│   ├── backtestStore.ts
│   ├── tradeStore.ts
│   ├── positionStore.ts
│   └── riskStore.ts
│
├── hooks/              # 自定义Hooks
│   ├── useStrategyData.ts
│   ├── useBacktest.ts
│   ├── useTradeStatistics.ts
│   ├── usePositionMonitor.ts
│   └── useRiskCheck.ts
│
├── utils/              # 工具函数
│   ├── formatters.ts   # 格式化函数
│   ├── calculators.ts  # 计算函数
│   ├── constants.ts    # 常量定义
│   └── validators.ts   # 参数验证
│
├── pages/              # 页面组件
│   ├── QuantDashboard.tsx
│   ├── StrategyManage.tsx
│   ├── BacktestLab.tsx
│   ├── TradeAnalysis.tsx
│   ├── PositionMonitor.tsx
│   └── RiskManagement.tsx
│
└── README.md           # 本文档
```

## 🔌 API集成

### 后端API基础URL
```typescript
const API_BASE_URL = 'http://45.249.246.109:3000';
```

### API路由前缀
```
/api/quant/*
```

### 主要API接口

#### 策略管理
- `GET /api/quant/strategies` - 获取所有策略
- `POST /api/quant/strategies` - 创建策略
- `PUT /api/quant/strategies/:id` - 更新策略
- `DELETE /api/quant/strategies/:id` - 删除策略
- `POST /api/quant/strategies/:id/toggle` - 启用/禁用策略

#### 回测系统
- `POST /api/quant/backtest` - 运行回测 ⭐
- `GET /api/quant/backtest/results` - 获取回测列表
- `GET /api/quant/backtest/results/:id` - 获取回测详情
- `GET /api/quant/backtest/results/:id/trades` - 获取交易明细

#### 风险管理
- `GET /api/quant/risk/config/:strategy_id` - 获取风控配置
- `PUT /api/quant/risk/config/:strategy_id` - 更新风控配置
- `GET /api/quant/risk/exposure` - 获取风险敞口
- `GET /api/quant/risk/check/:strategy_id` - 检查开仓风险

## 🎨 技术栈

- **React 18** + **TypeScript** - 核心框架
- **Zustand** - 轻量级状态管理
- **Ant Design** - UI组件库
- **Recharts** - 数据可视化图表
- **Axios** - HTTP客户端
- **SCSS Modules** - 样式方案

## 📊 数据流架构

```
用户操作 → Hooks → API Services → 后端API
                ↓
         Zustand Store
                ↓
         React Component
```

## ⚠️ 注意事项

### 1. API响应处理
项目使用 `apiClient` 自动解包API响应：
```typescript
// ✅ 正确
const strategies = await strategyAPI.getStrategies();
setStrategies(strategies); // 直接使用

// ❌ 错误
setStrategies(strategies.data); // apiClient已经解包了
```

### 2. 时区处理
- API返回的是UTC时间戳
- 前端显示时JavaScript Date对象自动转换为本地时区
- 无需手动转换

### 3. 类型安全
所有API和组件都有完整的TypeScript类型定义，确保类型安全。

## 🛠️ 开发指南

### 添加新的策略类型

1. 在 `types/strategy.ts` 添加类型定义
2. 在 `utils/constants.ts` 添加策略选项
3. 在 `utils/formatters.ts` 添加格式化函数

### 添加新的性能指标

1. 在 `types/backtest.ts` 添加指标类型
2. 在 `utils/calculators.ts` 添加计算函数
3. 在 `pages/BacktestLab.tsx` 添加显示逻辑

### 自定义Hook

所有数据获取逻辑都封装在自定义Hook中：
```typescript
const { strategies, isLoading, error, fetchStrategies } = useStrategyData();
```

## 🔧 故障排查

### API请求失败
1. 检查后端服务是否运行
2. 检查网络连接
3. 查看浏览器控制台的错误信息

### 数据不显示
1. 检查API响应格式（是否正确解包）
2. 检查状态更新逻辑
3. 查看组件的loading状态

### 样式问题
1. 检查SCSS模块是否正确导入
2. 检查CSS变量是否定义
3. 检查主题切换是否正常

## 📚 相关文档

- [后端API文档](../../../docs/QUANTITATIVE_SYSTEM_README.md)
- [项目开发指南](../../../CLAUDE.md)
- [Recharts文档](https://recharts.org/)
- [Ant Design文档](https://ant.design/)
- [Zustand文档](https://github.com/pmndrs/zustand)

## 🎯 后续优化

- [ ] 添加实时数据推送（WebSocket）
- [ ] 实现策略参数优化功能
- [ ] 添加更多技术指标
- [ ] 实现多策略组合功能
- [ ] 添加实盘交易支持

---

**更新时间**: 2025-10-07
**版本**: v1.0.0
**状态**: ✅ 开发完成
