# 智能加密货币交易前端管理系统 - Claude 开发指南

## 🤖 AI 助手行为规范

**回答问题时：**
- ✅ 用简洁文字描述，直接给出答案和解释
- ❌ 不要贴代码示例（除非用户明确要求）
- ✅ 用伪代码或文字描述逻辑即可
- ✅ 解释清楚原理、方案、思路

**执行任务/修改代码时：**
- ✅ 简短说明要做什么（1-2句话）
- ✅ 直接执行工具调用
- ✅ 完成后简短确认结果

**示例：**
```
用户：如何实现防抖功能？
❌ 冗长：防抖是这样实现的...[贴一大段代码]
✅ 简洁：使用闭包+定时器，延迟执行函数，每次触发时清除上次定时器重新计时。

用户：修复这个类型错误
❌ 冗长：我将帮你修复...首先读取...发现问题...现在修改...
✅ 简洁：修复类型错误 → [工具调用] → 已完成，添加了类型检查。
```

## 📋 项目概述

基于现代Web技术的加密货币交易管理前端系统，提供K线图表分析、币种管理、交易规则配置、信号监控等功能。

## 🛠️ 技术栈

- **React 18** + **TypeScript** - 核心框架
- **Vite** - 现代化构建工具，提供极快的开发体验
- **React Router** - 客户端路由管理
- **TailwindCSS** - 原子化CSS框架，支持深色模式
- **TradingView Charting Library** - 专业K线图表
- **Socket.io-client** - WebSocket实时通信
- **Zustand** - 轻量级状态管理
- **React Query (TanStack Query)** - 数据获取和缓存
- **Recharts** - 数据可视化图表
- **Ant Design** - UI组件库

## 🏗️ 系统架构

```
用户界面层 → 状态管理层 → 数据服务层 → WebSocket通信层 → 后端API
```

## 🎯 核心功能模块

### 1. K线图表模块 (`src/components/charts`)
- **TradingChart.tsx** - TradingView集成的专业K线图
- **ChartToolbar.tsx** - 时间周期切换工具栏
- **ChartIndicators.tsx** - 技术指标选择器
- **VolumeChart.tsx** - 成交量图表
- **MarketDepth.tsx** - 市场深度图

### 2. 币种管理模块 (`src/components/symbols`)
- **SymbolSelector.tsx** - 币种选择器
- **SymbolSearch.tsx** - 币种搜索功能
- **SymbolList.tsx** - 币种列表展示
- **SymbolConfig.tsx** - 币种配置管理
- **MarketOverview.tsx** - 市场概览面板

### 3. 交易规则模块 (`src/components/rules`) ⭐ **核心特性**
- **RuleBuilder.tsx** - 可视化规则构建器
- **RuleEditor.tsx** - 规则代码编辑器
- **RuleTemplates.tsx** - 预设规则模板
- **RuleBacktest.tsx** - 规则回测界面
- **RuleMonitor.tsx** - 规则运行监控

### 4. 信号提醒模块 (`src/components/signals`)
- **SignalPanel.tsx** - 信号面板
- **SignalHistory.tsx** - 历史信号记录
- **SignalNotification.tsx** - 实时信号通知
- **SignalFilters.tsx** - 信号过滤器
- **SignalStats.tsx** - 信号统计分析

### 5. 结构检测模块 (`src/components/structure`) ⭐ **新增**
- **StructurePanel.tsx** - 结构检测面板（区间形态、突破信号）
- **RangePrimitive.ts** - 自定义图元（Custom Primitives）用于在K线图上绘制区间范围框

### 6. 系统监控模块 (`src/components/monitoring`)
- **SystemStatus.tsx** - 系统状态监控
- **PerformanceMetrics.tsx** - 性能指标展示
- **ConnectionStatus.tsx** - WebSocket连接状态
- **CacheStatus.tsx** - 缓存状态监控

## 📁 项目结构

```
trading-master-front/
├── public/               # 静态资源
│   ├── index.html        # HTML模板
│   ├── favicon.ico       # 网站图标
│   └── manifest.json     # PWA配置
├── src/
│   ├── components/       # React组件
│   │   ├── charts/       # K线图表组件
│   │   │   ├── TradingChart.tsx
│   │   │   ├── ChartToolbar.tsx
│   │   │   ├── ChartIndicators.tsx
│   │   │   ├── VolumeChart.tsx
│   │   │   └── MarketDepth.tsx
│   │   ├── symbols/      # 币种管理组件
│   │   │   ├── SymbolSelector.tsx
│   │   │   ├── SymbolSearch.tsx
│   │   │   ├── SymbolList.tsx
│   │   │   ├── SymbolConfig.tsx
│   │   │   └── MarketOverview.tsx
│   │   ├── rules/        # 交易规则组件 ⭐
│   │   │   ├── RuleBuilder.tsx
│   │   │   ├── RuleEditor.tsx
│   │   │   ├── RuleTemplates.tsx
│   │   │   ├── RuleBacktest.tsx
│   │   │   └── RuleMonitor.tsx
│   │   ├── signals/      # 信号提醒组件
│   │   │   ├── SignalPanel.tsx
│   │   │   ├── SignalHistory.tsx
│   │   │   ├── SignalNotification.tsx
│   │   │   ├── SignalFilters.tsx
│   │   │   └── SignalStats.tsx
│   │   ├── structure/    # 结构检测组件 ⭐ 新增
│   │   │   ├── StructurePanel.tsx
│   │   │   └── RangePrimitive.ts  # 自定义图元
│   │   ├── monitoring/   # 系统监控组件
│   │   │   ├── SystemStatus.tsx
│   │   │   ├── PerformanceMetrics.tsx
│   │   │   ├── ConnectionStatus.tsx
│   │   │   └── CacheStatus.tsx
│   │   ├── layout/       # 布局组件
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Layout.tsx
│   │   └── ui/           # 通用UI组件
│   │       ├── PageHeader.tsx  # 📌 页面标题组件 (必用)
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Loading.tsx
│   │       └── index.ts        # UI组件统一导出
│   ├── pages/            # 页面组件 (React Router)
│   │   ├── Dashboard.tsx
│   │   ├── Trading.tsx
│   │   ├── Rules.tsx
│   │   ├── Signals.tsx
│   │   └── Settings.tsx
│   ├── hooks/            # 自定义Hooks
│   │   ├── useWebSocket.ts
│   │   ├── useKlineData.ts
│   │   ├── useRealTimeData.ts
│   │   └── useLocalStorage.ts
│   ├── services/         # API服务层
│   │   ├── api.ts
│   │   ├── websocket.ts
│   │   └── tradingAPI.ts
│   ├── stores/           # Zustand状态管理
│   │   ├── chartStore.ts
│   │   ├── ruleStore.ts
│   │   ├── signalStore.ts
│   │   └── userStore.ts
│   ├── types/            # TypeScript类型定义
│   │   ├── chart.ts
│   │   ├── trading.ts
│   │   ├── api.ts
│   │   └── index.ts
│   ├── utils/            # 工具函数
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── styles/           # 样式文件
│   │   ├── globals.css
│   │   ├── components.css
│   │   └── themes.css
│   ├── App.tsx           # 根组件
│   ├── App.css           # 根组件样式
│   ├── index.tsx         # 应用入口
│   ├── index.css         # 全局样式
│   └── react-app-env.d.ts # React类型声明
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript配置
├── tsconfig.app.json     # 应用TypeScript配置
├── tsconfig.node.json    # Node环境TypeScript配置
├── vite.config.ts        # Vite配置文件
├── tailwind.config.js    # TailwindCSS配置
├── postcss.config.js     # PostCSS配置
├── eslint.config.js      # ESLint配置
└── README.md             # 项目说明
```

## 🔧 核心数据模型

### 后端API接口定义

```typescript
// K线数据
interface KlineData {
  symbol: string;
  interval: string;
  open_time: number;
  close_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count: number;
  is_final: boolean;
}

// 市场数据
interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  timestamp: number;
}

// 币种配置
interface SymbolConfig {
  id?: number;
  symbol: string;
  display_name: string;
  base_asset: string;
  quote_asset: string;
  enabled: boolean;
  priority: number;
  category: 'major' | 'alt' | 'stable';
  exchange: string;
  min_price: number;
  min_qty: number;
}
```

### 前端状态管理

```typescript
// 图表状态
interface ChartState {
  selectedSymbol: string;
  timeframe: string;
  klineData: KlineData[];
  indicators: string[];
  isLoading: boolean;
}

// 规则状态
interface RuleState {
  rules: TradingRule[];
  activeRule?: TradingRule;
  backtestResults: BacktestResult[];
  isRunning: boolean;
}

// 信号状态
interface SignalState {
  signals: TradingSignal[];
  filters: SignalFilter;
  notifications: Notification[];
  unreadCount: number;
}
```

## ⚠️ 重要：API响应格式处理

### 🔥 关键知识点：apiClient自动解包机制

**项目中的 `services/apiClient.ts` 会自动处理API响应格式，避免常见错误！**

#### 后端API实际返回格式
```json
{
  "success": true,
  "data": [...],  // 实际数据在这里
  "params": {},
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### apiClient自动解包逻辑
```typescript
// 响应拦截器会自动处理
return data?.data !== undefined ? data.data : data;
```

#### ✅ 正确的代码写法
```typescript
// 🔥 直接使用响应数据，apiClient已自动解包
const statistics = await oiAPI.getOIStatistics();
setStatistics(statistics); // 这里statistics直接是数组

// 🔥 类型定义应该定义为解包后的类型
export type OIStatisticsResponse = OIStatistics[]; // 而不是包装对象
```

#### ❌ 错误的代码写法
```typescript
// ❌ 错误：尝试访问.data属性（apiClient已经解包了）
const statistics = await oiAPI.getOIStatistics();
setStatistics(statistics.data); // 这里会是undefined！

// ❌ 错误：类型定义为包装格式
export type OIStatisticsResponse = APIResponse<OIStatistics[]>;
```

#### 🎯 开发经验总结
1. **数据设置**：直接使用API响应，不要访问`.data`属性
2. **类型定义**：定义为解包后的数据类型
3. **调试技巧**：当API数据无法显示时，首先检查是否错误访问了`.data`属性
4. **兜底写法**：如果不确定，可以使用 `data?.data || data` 的兜底逻辑

#### 📋 各接口的正确使用方式
```typescript
// OI统计数据
const stats: OIStatistics[] = await oiAPI.getOIStatistics();

// OI异常数据
const anomalies: OIAnomaly[] = await oiAPI.getRecentAnomalies();

// OI服务状态（注意这个可能不同）
const status: OIServiceStatusData = await oiAPI.getOIServiceStatus();
```

---

## 📝 开发规范

### 命名约定 (camelCase)
```typescript
// 组件和函数
const TradingChart = () => {}
const fetchKlineData = async () => {}

// 变量和状态
const selectedSymbol = 'BTCUSDT';
const isLoading = false;

// 常量
const CHART_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];
const DEFAULT_SYMBOL = 'BTCUSDT';

// 样式类名
className="chart-container trading-view-chart"
```

### 🎨 UI组件规范

#### ⭐ **PageHeader组件 - 强制使用**

**所有页面组件都必须使用统一的PageHeader组件作为页面标题，禁止自定义标题样式。**

```typescript
// ✅ 正确使用方式
import PageHeader from '../components/ui/PageHeader';

const MyPage: React.FC<Props> = ({ isSidebarCollapsed }) => {
  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="页面标题"
        subtitle="页面描述信息"
        icon="📊"  // 可选的emoji图标
      >
        {/* 可选的额外内容，如刷新按钮、状态指示器等 */}
        <RefreshButton />
      </PageHeader>

      {/* 页面内容 */}
    </div>
  );
};

// ❌ 错误方式 - 禁止自定义标题
const BadPage: React.FC = () => {
  return (
    <div>
      <h1>自定义标题</h1>  {/* 禁止！必须使用PageHeader */}
      <div className="custom-header">...</div>  {/* 禁止！ */}
    </div>
  );
};
```

**PageHeader组件特性：**
- **统一视觉**: 所有页面保持一致的标题样式和动画效果
- **响应式**: 自动适配桌面端和移动端
- **主题支持**: 完全支持明暗主题切换
- **动画效果**: 内置滑入动画和下划线渐显效果
- **扩展性**: 支持图标和额外内容(按钮、状态等)

**接口定义：**
```typescript
interface PageHeaderProps {
  title: string;              // 必需：页面标题
  subtitle: string;           // 必需：页面副标题/描述
  icon?: React.ReactNode;     // 可选：图标(推荐使用emoji)
  children?: React.ReactNode; // 可选：额外内容(按钮等)
}
```

**使用示例：**
```typescript
// 基础用法
<PageHeader
  title="交易仪表板"
  subtitle="实时交易数据概览和市场分析"
  icon="📈"
/>

// 带额外内容
<PageHeader
  title="系统监控"
  subtitle="实时监控系统健康状态和性能指标"
  icon="🖥️"
>
  {isRefreshing && <RefreshIndicator />}
  <ActionButton onClick={handleAction} />
</PageHeader>
```

### 组件设计原则

```typescript
// 1. 函数式组件 + Hooks
const TradingChart: React.FC<TradingChartProps> = ({ symbol, interval }) => {
  const [data, setData] = useState<KlineData[]>([]);

  return <div className="trading-chart">...</div>;
};

// 2. 自定义Hook封装业务逻辑
const useKlineData = (symbol: string, interval: string) => {
  // WebSocket连接和数据处理逻辑
};

// 3. 类型安全
interface TradingChartProps {
  symbol: string;
  interval: string;
  onSymbolChange?: (symbol: string) => void;
}
```

## 💡 核心要求

1. **UI一致性** - 🔥 **所有页面必须使用PageHeader组件**，禁止自定义标题样式
2. **API数据处理** - ⚠️ **apiClient自动解包响应，直接使用响应数据，不要访问.data属性**
3. **响应式设计** - 支持桌面端和移动端
4. **实时数据** - WebSocket数据实时更新
5. **性能优化** - 虚拟滚动、懒加载、数据缓存
6. **用户体验** - 流畅的交互和加载状态
7. **可访问性** - ARIA标签和键盘导航支持
8. **国际化** - 支持中英文切换
9. **错误处理** - 优雅的错误边界和重试机制

## 🔍 关键实现点

### ⏰ 时区处理规范 ⭐ **重要**

**lightweight-charts 不原生支持时区配置**，需要手动调整时间戳来显示北京时间（UTC+8）。

#### 核心原则
1. **时间戳是绝对值**：后端返回标准UTC时间戳（从1970-01-01 00:00:00 UTC开始的毫秒数）
2. **apiClient不做转换**：保持原始时间戳不变
3. **图表数据需要 +8小时**：传给图表库的时间戳需要手动 +8 小时
4. **文本显示自动处理**：JavaScript `Date` 对象自动根据浏览器时区显示

#### 需要 +8 小时的位置（仅图表显示）

```typescript
// 1. klineAPI.ts - K线数据转换
time: Math.floor(k.open_time / 1000) + 8 * 3600

// 2. TradingViewChart.tsx - 信号标记
const timeInSeconds = Math.floor(signal.timestamp / 1000) + 8 * 3600;

// 3. TradingViewChart.tsx - 区间范围框
const startTimeSeconds = Math.floor(range.start_time / 1000) + 8 * 3600;
const endTimeSeconds = Math.floor(range.end_time / 1000) + 8 * 3600;

// 4. TradingViewChart.tsx - 突破信号标记
const timeInSeconds = Math.floor(breakout.breakout_time / 1000) + 8 * 3600;
```

#### 不需要调整的位置（自动显示本地时间）

```typescript
// StructurePanel、SignalPanel 等文本显示
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp); // 自动根据浏览器时区显示
  return date.toLocaleString('zh-CN');
};
```

### 🎨 Custom Primitives（自定义图元）⭐ **新增**

用于在 K线图上绘制自定义图形，如区间范围框。

#### RangePrimitive 实现要点

```typescript
// src/components/charts/RangePrimitive.ts
export class RangePrimitive implements ISeriesPrimitive<Time> {
  // 1. paneViews() - 返回绘制逻辑
  paneViews(): readonly any[] {
    return [{
      zOrder(): 'bottom' | 'normal' | 'top' { return 'bottom'; },
      renderer(): any {
        return {
          draw(target: any): void {
            // 访问内部属性：target._context, target._bitmapSize
            const ctx = target._context;
            const width = target._bitmapSize.width;

            // 时间转坐标
            const timeScale = self._series.chart.timeScale();
            const startX = timeScale.timeToCoordinate(startTime);

            // 绘制矩形和边框
            ctx.fillRect(startX, y, width, height);
          }
        };
      }
    }];
  }

  // 2. priceAxisViews() - 价格轴标签
  priceAxisViews(): readonly any[] {
    return [{
      coordinate(): number { return y; },
      text(): string { return price.toFixed(2); },
      textColor(): string { return '#FFFFFF'; },
      backColor(): string { return '#3B82F6'; }
    }];
  }
}
```

#### 防止无限延伸的关键处理

```typescript
// 问题：区间结束时间超出可见范围，导致矩形延伸到右边缘
// 解决：使用 timeScale.getVisibleRange() 限制边界

if (self._data.endTime !== undefined) {
  const endCoord = timeScale.timeToCoordinate(self._data.endTime);
  if (endCoord !== null) {
    endX = endCoord;
  } else {
    // 结束时间超出范围，使用可见区域右边界
    const visibleRange = timeScale.getVisibleRange();
    if (visibleRange && visibleRange.to !== null) {
      const visibleEndCoord = timeScale.timeToCoordinate(visibleRange.to);
      if (visibleEndCoord !== null) {
        endX = visibleEndCoord;
      }
    }
  }
}
```

### WebSocket连接管理
```typescript
// hooks/useWebSocket.ts
const useWebSocket = (symbol: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(WS_URL);
    newSocket.emit('subscribe', { streams: [`${symbol}@kline_1m`] });
    setSocket(newSocket);

    return () => newSocket.close();
  }, [symbol]);

  return socket;
};
```

### 状态管理 (Zustand)
```typescript
// stores/chartStore.ts
const useChartStore = create<ChartState>((set, get) => ({
  selectedSymbol: 'BTCUSDT',
  timeframe: '1h',
  klineData: [],

  setSymbol: (symbol: string) => set({ selectedSymbol: symbol }),
  setTimeframe: (timeframe: string) => set({ timeframe }),
  updateKlineData: (data: KlineData[]) => set({ klineData: data }),
}));
```

### API服务层
```typescript
// services/api.ts
class TradingAPI {
  async getKlineData(symbol: string, interval: string): Promise<KlineData[]> {
    const response = await fetch(`/api/klines?symbol=${symbol}&interval=${interval}`);
    return response.json();
  }

  async getSymbols(): Promise<SymbolConfig[]> {
    const response = await fetch('/api/symbols');
    return response.json();
  }
}
```

## 🎨 页面布局设计

### 主要页面结构

```
├─────────────────────────────────────────────────┤
│ 侧边栏  │            主内容区域                  │
│  币种   │  ┌─────────────────────────────────┐  │
│  选择   │  │        K线图表区域              │  │
│  器     │  │                                 │  │
│        │  └─────────────────────────────────┘  │
│ 功能   │  ┌─────────────────────────────────┐  │
│ 导航   │  │    交易规则/信号面板区域          │  │
│        │  │                                 │  │
│        │  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 响应式设计
- **桌面端** (≥1024px): 侧边栏 + 主内容双栏布局
- **平板端** (768px-1023px): 可折叠侧边栏 + 主内容
- **移动端** (<768px): 底部导航栏 + 全屏主内容

## 🚀 开发流程

### 1. 环境配置
```bash
# 安装依赖
npm install

# 启动开发服务器 (Vite HMR热更新)
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
```

### 2. API集成
```typescript
// 配置后端API地址 (Vite环境变量需要以VITE_开头)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

// 环境变量配置示例 (.env 文件)
// VITE_API_URL=http://localhost:3001
// VITE_WS_URL=ws://localhost:3001
// VITE_APP_NAME=Trading Master
```

### 3. 组件开发顺序
1. **核心UI组件** - 📌 **PageHeader(必用)**, Button, Input, Modal等
2. **布局组件** - Header, Sidebar, Layout
3. **页面组件** - 🔥 **所有页面必须使用PageHeader组件**
4. **K线图表组件** - 集成TradingView
5. **币种管理组件** - 选择器和列表
6. **交易规则组件** - 规则构建器
7. **信号提醒组件** - 实时通知系统

### 4. 页面开发检查清单
开发任何新页面时，请确保：
- ✅ **使用PageHeader组件** - 不允许自定义标题样式
- ✅ **正确的props传递** - title, subtitle, icon
- ✅ **响应式布局** - 支持侧边栏折叠状态
- ✅ **主题适配** - 支持明暗主题切换
- ✅ **动画效果** - PageHeader自动提供标准动画

## 📊 性能优化策略

### 1. Vite构建优化
```typescript
// vite.config.ts - 构建优化配置
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          ui: ['antd'],
          trading: ['socket.io-client']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    hmr: true, // 热模块替换
    port: 3000
  }
})
```

### 2. 代码分割与懒加载
```typescript
// 懒加载重型组件
const TradingChart = lazy(() => import('./components/charts/TradingChart'));
const RuleBuilder = lazy(() => import('./components/rules/RuleBuilder'));

// 使用 Suspense 包装
<Suspense fallback={<div>Loading...</div>}>
  <TradingChart />
</Suspense>
```

### 3. 数据缓存
```typescript
// React Query缓存配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟
      cacheTime: 10 * 60 * 1000, // 10分钟
    },
  },
});
```

### 4. 虚拟滚动
```typescript
// 大数据列表虚拟滚动
import { FixedSizeList as List } from 'react-window';

const VirtualList = ({ items }: { items: any[] }) => (
  <List height={600} itemCount={items.length} itemSize={50}>
    {({ index, style }) => (
      <div style={style}>{items[index]}</div>
    )}
  </List>
);
```

## 🔐 安全考虑

1. **XSS防护** - 所有用户输入经过sanitize处理
2. **CSRF防护** - API请求包含CSRF token
3. **数据验证** - 前后端双重验证
4. **敏感信息** - API密钥等通过环境变量配置

## 📱 移动端优化

1. **触摸友好** - 按钮和操作区域≥44px
2. **手势支持** - 图表缩放和拖拽
3. **离线支持** - Service Worker缓存关键资源
4. **PWA支持** - 可安装的Web应用

## ⚡ Vite开发特性

### 1. 极速开发启动
- **冷启动时间**: 毫秒级，无需打包整个应用
- **热更新(HMR)**: 保留应用状态的instant更新
- **按需编译**: 只编译当前访问的模块

### 2. 现代化构建
- **ES模块**: 原生支持ES模块，无需转换
- **Tree Shaking**: 自动移除未使用的代码
- **代码分割**: 智能分包，优化加载性能

### 3. 开发体验
```typescript
// 热更新配置
if (import.meta.hot) {
  import.meta.hot.accept('./stores/chartStore', (newModule) => {
    // 热更新状态管理
  });
}

// 环境变量类型定义
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_APP_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### 4. 部署优化
```bash
# 构建分析
npm run build -- --analyze

# 预加载资源
npm run build -- --mode production

# PWA支持
npm install vite-plugin-pwa -D
```

---

**目标**: 构建现代化、高性能、用户友好的加密货币交易管理前端系统，基于Vite构建工具提供极致的开发体验，为量化交易提供直观的可视化界面和便捷的管理工具。