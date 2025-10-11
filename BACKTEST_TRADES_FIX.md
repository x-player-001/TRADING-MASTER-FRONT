# 修复回测交易明细显示问题

## 问题
CZSC API返回的数据中包含trades数组，但前端没有显示。

## 解决方案

### 1. 修改 `src/quantitative/services/backtestAPI.ts`

在第 94 行 `created_at` 后面添加两个字段：

```typescript
    created_at: czscResult.created_at || new Date().toISOString(),
    task_id: czscResult.task_id,
    trades: czscResult.trades.map((trade, index) => ({
      id: index,
      backtest_id: 0,
      entry_time: trade.entry_time,
      exit_time: trade.exit_time,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      quantity: 1,
      profit: trade.profit,
      profit_rate: trade.profit_rate,
      direction: 'long' as const
    }))
```

### 2. 修改 `src/quantitative/hooks/useBacktest.ts`

在第 35 行 `selectBacktest(result);` 后面添加：

```typescript
      // 如果result中包含trades，直接设置到store
      if ((result as any).trades && Array.isArray((result as any).trades)) {
        setBacktestTrades((result as any).trades);
      }
```

并在第 43 行的依赖数组中添加 `setBacktestTrades`：

```typescript
  }, [addBacktest, selectBacktest, setBacktestTrades, setRunning, setError]);
```

### 3. 修改 `src/quantitative/types/backtest.ts`

在 BacktestResult 接口的第 57 行 `created_at: string;` 后面添加：

```typescript
  task_id?: string;           // CZSC系统的任务ID
  trades?: Trade[];           // 交易明细（CZSC直接返回）
```

## 修改完成后
刷新页面重新运行回测，交易明细就能正常显示了。
