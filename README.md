# 智能加密货币交易前端管理系统

> 基于 React 18 + TypeScript + Vite 构建的现代化加密货币交易管理前端系统

## 📋 项目简介

这是一个专业的加密货币交易管理前端系统，提供K线图表分析、币种管理、交易规则配置、信号监控等功能。采用现代化的技术栈，为量化交易提供直观的可视化界面和便捷的管理工具。

## 🛠️ 技术栈

- **核心框架**: React 18 + TypeScript
- **构建工具**: Vite (极速开发体验)
- **路由管理**: React Router
- **样式框架**: TailwindCSS (支持深色模式)
- **状态管理**: Zustand (轻量级)
- **数据获取**: TanStack Query (React Query)
- **实时通信**: Socket.io-client
- **图表组件**: Recharts + TradingView
- **UI组件库**: Ant Design
- **代码规范**: ESLint + TypeScript ESLint

## 🚀 快速开始

### 环境要求

- Node.js >= 18.x
- npm >= 9.x

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
# 启动开发服务器 (支持热更新)
npm run dev

# 访问地址: http://localhost:5173
```

### 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
```

## 📁 项目结构

```
trading-master-front/
├── public/               # 静态资源
├── src/
│   ├── components/       # React组件
│   │   ├── charts/       # K线图表组件
│   │   ├── symbols/      # 币种管理组件
│   │   ├── rules/        # 交易规则组件 ⭐
│   │   ├── signals/      # 信号提醒组件
│   │   ├── monitoring/   # 系统监控组件
│   │   ├── layout/       # 布局组件
│   │   └── ui/           # 通用UI组件
│   ├── pages/            # 页面组件
│   ├── hooks/            # 自定义Hooks
│   ├── services/         # API服务层
│   ├── stores/           # 状态管理
│   ├── types/            # TypeScript类型定义
│   ├── utils/            # 工具函数
│   └── styles/           # 样式文件
├── package.json          # 项目配置
├── vite.config.ts        # Vite配置
├── tailwind.config.js    # TailwindCSS配置
└── tsconfig.json         # TypeScript配置
```

## 🎯 核心功能

### 📊 K线图表模块
- TradingView专业K线图集成
- 多时间周期切换
- 技术指标分析
- 成交量图表
- 市场深度图

### 💰 币种管理
- 币种选择器
- 实时搜索功能
- 市场概览面板
- 币种配置管理

### ⚙️ 交易规则 (核心特性)
- 可视化规则构建器
- 规则代码编辑器
- 预设规则模板
- 规则回测功能
- 实时运行监控

### 🔔 信号提醒
- 实时信号通知
- 历史信号记录
- 信号过滤器
- 统计分析面板

### 📈 系统监控
- 系统状态监控
- 性能指标展示
- WebSocket连接状态
- 缓存状态监控

## 🔧 配置说明

### 环境变量

创建 `.env` 文件配置环境变量：

```bash
# API服务地址
VITE_API_URL=http://localhost:3001

# WebSocket服务地址
VITE_WS_URL=ws://localhost:3001

# 应用名称
VITE_APP_NAME=Trading Master
```

### Vite配置优化

项目已配置Vite性能优化：

- 🔥 毫秒级热更新
- 📦 智能代码分割
- 🌳 自动Tree Shaking
- ⚡ 按需编译

## 📱 响应式设计

- **桌面端** (≥1024px): 侧边栏 + 主内容双栏布局
- **平板端** (768-1023px): 可折叠侧边栏
- **移动端** (<768px): 底部导航栏 + 全屏内容

## 🔐 安全特性

- XSS防护 (输入过滤)
- CSRF防护 (Token验证)
- 环境变量安全管理
- 前后端双重数据验证

## 📚 开发文档

详细的开发指南和架构说明请参考 [CLAUDE.md](./CLAUDE.md)

## 🤝 参与贡献

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🎯 项目目标

构建现代化、高性能、用户友好的加密货币交易管理前端系统，基于Vite构建工具提供极致的开发体验，为量化交易提供直观的可视化界面和便捷的管理工具。

---

💡 **技术支持**: 如有问题请查看 [CLAUDE.md](./CLAUDE.md) 开发文档或提交 Issue
