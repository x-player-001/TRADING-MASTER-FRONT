# CZSC策略配置完整指南

## 快速开始

### 已验证的策略（可直接使用）

我们提供了**4个经过完整测试的策略**，可以直接用于前端调用：

1. **笔方向策略** - 基于笔的方向进行交易
2. **一买策略** - 基于缠论一买点开仓
3. **二买二卖策略** - 基于缠论二买二卖点
4. **三买三卖策略** - 基于缠论三买三卖点

📄 详见: [VERIFIED_STRATEGY_CONFIGS.md](VERIFIED_STRATEGY_CONFIGS.md)

### 自定义策略（无限可能）

CZSC提供了**49+个信号函数**供你自由组合：

- **czsc.signals.cxt**: 缠论上下文信号（笔、买卖点、中枢等）
- **czsc.signals.bar**: K线信号
- **czsc.signals.tas**: 技术分析信号（MA、MACD、RSI等）
- **czsc.signals.vol**: 成交量信号
- **czsc.signals.pos**: 持仓信号

📄 详见: [CUSTOM_STRATEGY_GUIDE.md](CUSTOM_STRATEGY_GUIDE.md)

---

## 文档导航

| 文档 | 说明 | 适用人群 |
|-----|------|---------|
| [VERIFIED_STRATEGY_CONFIGS.md](VERIFIED_STRATEGY_CONFIGS.md) | 已验证策略配置，包含4个可直接使用的策略 | 前端开发、快速上手 |
| [CUSTOM_STRATEGY_GUIDE.md](CUSTOM_STRATEGY_GUIDE.md) | 自定义策略创建指南，49+信号函数库 | 策略开发、高级用户 |
| [STRATEGY_CREATION_GUIDE.md](STRATEGY_CREATION_GUIDE.md) | 详细的创建指南（旧版，供参考） | 深入了解 |

---

## 工具脚本

### 1. 信号测试助手

快速测试任何CZSC信号函数，自动生成配置模板：

```bash
# 列出可用信号
python test_signal_helper.py list czsc.signals.cxt

# 测试笔方向信号
python test_signal_helper.py test czsc.signals.cxt.cxt_bi_base_V230228 bi_init_length=9

# 测试笔结束信号
python test_signal_helper.py test czsc.signals.cxt.cxt_bi_end_V230104 di=1

# 测试一买信号
python test_signal_helper.py test czsc.signals.cxt.cxt_first_buy_V221126 di=1
```

**输出内容:**
- 信号的完整名称（7段格式）
- 可直接使用的配置模板JSON
- 详细的测试结果

### 2. 策略集成测试

测试你的策略配置是否正确：

```bash
# 测试所有已验证的策略
python test_all_verified_strategies.py

# 测试单个策略（需自己修改脚本）
python test_my_strategy.py
```

---

## 关键概念速查

### 信号名称格式（7段）

```
完整信号名 = signal_key (3段) + "_" + signal_value (4段)

示例:
15分钟_D0BL9_V230228_向上_任意_任意_0
└──────┬──────┘ └────┬────┘
   signal_key    signal_value
```

### Factor配置规则

```json
{
  "name": "因子名称",
  "signals_all": ["信号1"],  // ⚠️ 不能为空！至少1个
  "signals_any": [],          // 建议留空
  "signals_not": []           // 排除信号
}
```

### 操作代码

- `"LO"` - 开多 (Long Open)
- `"LE"` - 平多 (Long Exit)
- `"SO"` - 开空 (Short Open)
- `"SE"` - 平空 (Short Exit)

### 逻辑组合

- **AND逻辑**: 同一Factor的signals_all中放多个信号
- **OR逻辑**: 创建多个Event，每个Event一个Factor
- **NOT逻辑**: 使用signals_not

---

## 典型使用场景

### 场景1: 前端需要提供策略列表

使用已验证的4个策略配置：

```python
# 读取verified_strategies.json
import json
with open('verified_strategies.json', 'r', encoding='utf-8') as f:
    strategies = json.load(f)['strategies']

# 返回给前端
return {
    'strategies': [
        {
            'id': i,
            'name': s['name'],
            'description': s['description'],
            'tested': s['tested']
        }
        for i, s in enumerate(strategies)
    ]
}
```

### 场景2: 用户选择策略进行回测

```python
# 从数据库获取策略配置
strategy = get_strategy_from_db(strategy_id)

# 调用回测接口
POST /api/backtest/position
{
  "symbol": "BTCUSDT",
  "freq": "15分钟",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "positions_config": strategy['positions_config'],
  "signals_config": strategy['signals_config'],
  "ensemble_method": "mean",
  "fee_rate": 0.0002,
  "digits": 2
}
```

### 场景3: 用户想创建自定义策略

1. 前端提供信号函数选择器（从49+函数中选择）
2. 使用 `test_signal_helper.py` 测试信号输出
3. 根据测试结果构建配置
4. 保存到数据库
5. 调用回测接口验证

### 场景4: 批量回测多个策略

```python
strategies = [
    load_strategy('笔方向策略'),
    load_strategy('一买策略'),
    load_strategy('二买二卖策略'),
]

results = []
for strategy in strategies:
    result = backtest_position(strategy)
    results.append({
        'strategy_name': strategy['name'],
        'sharpe_ratio': result['sharpe'],
        'max_drawdown': result['max_dd'],
        'total_return': result['return']
    })

# 返回对比结果
return results
```

---

## API接口规范

### 回测接口

```
POST /api/backtest/position
```

**请求参数:**

```json
{
  "symbol": "BTCUSDT",           // 交易标的
  "freq": "15分钟",              // K线周期
  "start_date": "2024-01-01",   // 回测开始日期
  "end_date": "2024-12-31",     // 回测结束日期
  "positions_config": [...],    // Position配置数组
  "signals_config": [...],      // 信号函数配置数组
  "ensemble_method": "mean",    // 权重聚合方法
  "fee_rate": 0.0002,          // 手续费率
  "digits": 2                   // 价格精度
}
```

**响应示例:**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "backtest_id": "bt_20250115_001",
    "strategy_name": "笔方向策略",
    "metrics": {
      "total_return": 0.156,
      "sharpe_ratio": 1.23,
      "max_drawdown": 0.082,
      "win_rate": 0.567,
      "total_trades": 45
    },
    "equity_curve": [...],
    "trades": [...]
  }
}
```

---

## 常见问题

### Q: 只有这4个策略吗？

**A:** 不是！这4个是经过完整验证的**示例**策略。CZSC提供了**49+个信号函数**，你可以自由组合创建**无限种策略**。参见 [CUSTOM_STRATEGY_GUIDE.md](CUSTOM_STRATEGY_GUIDE.md)

### Q: 如何知道有哪些信号函数可用？

**A:** 使用工具脚本：

```bash
python test_signal_helper.py list czsc.signals.cxt
python test_signal_helper.py list czsc.signals.tas
python test_signal_helper.py list czsc.signals.bar
```

### Q: 如何测试新的信号函数？

**A:** 使用测试助手：

```bash
python test_signal_helper.py test czsc.signals.cxt.信号函数名 参数1=值1 参数2=值2
```

工具会自动：
1. 创建测试数据
2. 调用信号函数
3. 显示信号输出
4. 生成配置模板

### Q: 前端需要提供哪些配置选项？

**A:** 推荐的前端UI结构：

1. **策略模板选择**
   - 显示4个已验证策略
   - 用户可以直接选择使用

2. **自定义策略**
   - 信号函数选择器（分类展示49+函数）
   - 参数输入框（根据选择的函数动态显示）
   - 开仓/平仓条件配置
   - 风控参数设置（interval、timeout、stop_loss）

3. **回测参数**
   - 标的选择（symbol）
   - 周期选择（freq）
   - 日期范围
   - 手续费率

### Q: 策略配置存储在哪里？

**A:**
- **前端创建**: 存储在 `position_strategies` 表
- **后端验证**: 使用 `position_strategy_service.py` 的验证逻辑
- **回测使用**: 从数据库读取并传给回测接口

数据库表结构:
```sql
CREATE TABLE position_strategies (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255),
    positions_config JSON,  -- Position配置
    signals_config JSON,    -- 信号配置
    created_at TIMESTAMP
);
```

### Q: 如何验证用户创建的策略是否正确？

**A:**
1. **前端验证**: 检查必填字段、数据类型
2. **后端验证**: `_validate_positions_config()` 方法
3. **测试验证**: 使用测试脚本跑一遍确认无错误

建议流程:
```
用户创建 → 前端验证 → 保存到数据库 → 后端验证 → 测试运行 → 正式使用
```

---

## 技术支持

遇到问题？

1. 查看相关文档
2. 运行测试脚本确认配置正确
3. 查看CZSC项目文档: https://czsc.readthedocs.io/
4. 查看飞书文档: https://s0cqcxuy3p.feishu.cn/wiki/

---

**最后更新**: 2025-10-15
**验证状态**: ✅ 所有策略和工具已通过测试
