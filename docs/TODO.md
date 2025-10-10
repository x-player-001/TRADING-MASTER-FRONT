# 📋 Trading Master Frontend - TODO List

## 🔴 高优先级 (High Priority)

### K线图表页面
- [ ] **修复切换周期时的加载状态问题**
  - **问题描述**: 切换K线周期（如从1m切换到5m）时，虽然数据正常加载，但在加载过程中会短暂显示"暂无K线数据"提示，而不是显示加载动画
  - **根本原因**: React 18+ 的批量更新机制导致多次 `setLoading()` 调用时，中间状态在渲染时丢失
  - **技术细节**:
    - `setInterval()` 清空 klines 并设置 `isLoading: true`
    - useEffect 触发 `fetchKlines()` 再次设置 `isLoading: true`
    - React 批处理这些更新，导致某些渲染帧中 `isLoading` 为 `false`
  - **可能的解决方案**:
    1. 使用 `useLayoutEffect` 替代 `useEffect` 进行同步状态更新
    2. 引入 `useTransition` API 控制过渡状态
    3. 使用 React 19 的并发特性优化状态更新
    4. 在 Zustand store 中实现更精细的状态管理逻辑
  - **相关文件**:
    - `src/stores/klineStore.ts` - 状态管理
    - `src/hooks/useKlineData.ts` - 数据获取 Hook
    - `src/pages/KlineChart.tsx` - 页面组件
  - **调试日志位置**: 搜索 `[KlineStore]` 和 `[useKlineData]`

---

## 🟡 中优先级 (Medium Priority)

### 性能优化
- [ ] 优化 TradingView 图表重渲染性能
- [ ] 实现图表数据虚拟化（大数据量场景）
- [ ] 添加数据预加载和缓存策略

### 用户体验
- [ ] 添加图表缩放和平移功能
- [ ] 实现图表数据导出功能（CSV/JSON）
- [ ] 添加多周期对比视图
- [ ] 实现自定义时间范围选择

### 功能增强
- [ ] 添加技术指标绘制（MA、EMA、MACD等）
- [ ] 实现交易信号标记功能
- [ ] 添加价格预警设置
- [ ] 实现K线数据回放功能

---

## 🟢 低优先级 (Low Priority)

### 代码质量
- [ ] 为 K线相关组件添加单元测试
- [ ] 优化 TypeScript 类型定义
- [ ] 重构重复代码，提取公共逻辑

### 文档完善
- [ ] 补充 K线图表组件使用文档
- [ ] 添加 API 接口调用示例
- [ ] 编写性能优化最佳实践指南

### UI/UX 改进
- [ ] 适配移动端手势操作
- [ ] 优化暗色模式下的颜色对比度
- [ ] 添加图表主题自定义功能

---

## ✅ 已完成 (Completed)

- [x] 创建 K线图表基础页面结构
- [x] 集成 TradingView Lightweight Charts
- [x] 实现币种选择器
- [x] 实现周期切换器
- [x] 添加统计卡片展示
- [x] 使用统一的 StatusCard 组件
- [x] 将周期选择器移至图表标题栏
- [x] 去除紫色渐变背景，统一视觉风格
- [x] 修复数据完整性检查报错
- [x] 设置默认周期为 5m
- [x] 支持明暗主题切换

---

## 📝 备注

### 开发规范提醒
1. **强制使用 PageHeader 组件** - 所有页面必须使用统一的 PageHeader 组件作为页面标题
2. **API 数据处理** - apiClient 自动解包响应，直接使用响应数据，不要访问 `.data` 属性
3. **响应式设计** - 确保所有新组件支持桌面端和移动端
4. **主题适配** - 所有样式必须适配明暗主题

### 技术债务
- useEffect 依赖项问题可能导致无限循环，需要重构
- Zustand 状态更新与 React 渲染周期的同步问题
- 图表组件的生命周期管理需要优化

---

**最后更新**: 2025-01-15
**维护者**: Development Team
