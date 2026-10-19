
# 缠论分析 API（`/api/chan`）

新版缠论引擎 `src/analysis/chan/` 的只读接口，供前端在K线图上画出 **笔、线段、中枢、买卖点**，用于人工核对结构划分。
（与旧 `/api/structure` 无关）

分析链：原始K线 → 去包含 → 分型 → 笔 → 线段（特征序列）→ 笔中枢 / 线段中枢 → MACD 背驰 → 一二三类买卖点

---

## GET /api/chan/analyze

一次请求返回K线 + 全部结构，前端直接画。

```
GET /api/chan/analyze?symbol=BTCUSDT&interval=1h&limit=1000&include_klines=1
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `symbol` | 必填 | 如 `BTCUSDT`；也支持 CME `ES` / `GC`。币种列表可用现成的 `GET /api/replay/symbols` |
| `interval` | `1h` | `5m` / `15m` / `1h` / `4h` |
| `limit` | `1000` | 已收盘K线根数，50~3000。建议 1h/4h 用 1000，5m/15m 用 2000 |
| `include_klines` | `0` | **前端画图传 `1`**，附带K线（与结构严格同一份数据） |
| `end_time` | 现在 | 毫秒时间戳，查看历史某时刻的结构（只用该时刻前已收盘K线），可用来观察结构如何随时间变化 |
| `bi_mode` | `strict` | `strict` 老笔 / `loose` 新笔，可做成切换开关对比 |
| `min_bi_raw_bars` | `5` | 仅 `loose` 生效：一笔至少包含的原始K线数 |
| `divergence_ratio` | `1` | 离开段 MACD 面积 < 进入段 × 该值视为背驰（越小越严） |
| `allow_consolidation_bsp1` | `1` | `0` 时不输出盘整背驰的一类买卖点 |
| `include_fractals` | `0` | `1` 时附带全部分型（调试用，数量多） |

只统计已收盘K线，最后一根未收盘的不参与计算。数据每根K线收盘后才会变，前端在新K线收盘时刷新即可（如 1h 每小时一次）。

### 返回示例（BTCUSDT 4h，每个数组只截取 1~2 条）

```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "interval": "4h",
    "options": {},
    "kline_count": 297,
    "merged_count": 192,
    "first_time": 1788048000000,
    "last_time": 1792353600000,
    "last_close": 82078,
    "klines": [
      { "open_time": 1792353600000, "close_time": 1792367999999, "open": 80840.9, "high": 82200,
        "low": 80622, "close": 82078, "volume": 24404.898, "is_closed": true }
    ],
    "bis": [
      { "index": 13, "direction": "down",
        "start_time": 1792137600000, "start_price": 82900.5,
        "end_time": 1792267200000, "end_price": 80751,
        "raw_start": 281, "raw_end": 290, "high": 82900.5, "low": 80751,
        "macd_area": 75.07, "is_confirmed": false }
    ],
    "segments": [
      { "index": 0, "direction": "up",
        "start_time": 1789488000000, "start_price": 74909.4,
        "end_time": 1790020800000, "end_price": 87385.1,
        "raw_start": 97, "raw_end": 134, "high": 87385.1, "low": 74909.4,
        "macd_area": 7042.63, "is_confirmed": false, "bi_start": 4, "bi_end": 4 }
    ],
    "bi_centers": [
      { "index": 1, "level": "bi", "item_start": 5, "item_end": 10,
        "zg": 85224, "zd": 83450.1, "gg": 87385.1, "dd": 80344.8,
        "start_time": 1790020800000, "end_time": 1791777600000,
        "entry_item": 4, "exit_item": 11, "leave_item": 12, "is_completed": true }
    ],
    "seg_centers": [],
    "bsp": [
      { "level": "bi", "type": "3", "side": "buy", "item_index": 5, "price": 83450.1,
        "time": 1790179200000, "raw_index": 145, "center_index": 0, "is_confirmed": true },
      { "level": "bi", "type": "3", "side": "sell", "item_index": 12, "price": 82900.5,
        "time": 1792137600000, "raw_index": 281, "center_index": 1, "is_confirmed": true }
    ]
  }
}
```

---

## 前端画法

所有时间都是**毫秒**，并且都等于某根K线的 `open_time`（价格点落在该K线的高点或低点上），可直接对齐。
TradingView lightweight-charts 用秒，需 `/ 1000`。
`raw_start` / `raw_end` / `raw_index` 是 `klines` 数组下标（传 `include_klines=1` 时），按下标定位也可以。

### 1. 笔 `bis` —— 细折线

每一笔画一条线段：`(start_time, start_price)` → `(end_time, end_price)`。相邻笔首尾相接，整体就是一条折线。

- `is_confirmed = false`（只可能是最后一笔）画**虚线**：它还会随新K线延伸
- 颜色可按 `direction` 区分，或统一一种颜色

### 2. 线段 `segments` —— 粗折线

画法同笔，线更粗、换颜色。`is_confirmed = false` 的最后一段画虚线。
线段需要至少 3 笔，数据少或单边行情时可能只有 0~1 段，属正常。

### 3. 中枢 `bi_centers` / `seg_centers` —— 矩形

- 矩形：时间 `start_time` → `end_time`，价格 `zd`（下沿）→ `zg`（上沿）
- `is_completed = false`（进行中）的中枢，右边界延伸到最后一根K线
- 可选：用虚线标出 `gg` / `dd`（中枢内最高、最低点）
- 笔中枢和线段中枢用不同颜色或透明度，线段中枢更大、更醒目

### 4. 买卖点 `bsp` —— 标记

在 `(time, price)` 处打标记：

| 字段 | 显示建议 |
|---|---|
| `side` | `buy` 画在K线下方、向上箭头、绿色；`sell` 画在上方、向下箭头、红色 |
| `type` | 文字 `1买` `2买` `3买` / `1卖` `2卖` `3卖` |
| `level` | `bi` 小号标记；`seg` 大号或加粗（线段级别更重要） |
| `is_confirmed` | `false` 用空心或半透明，悬浮提示「未确认，可能消失」 |
| `divergence_type` | 一类的悬浮提示：`trend` 趋势背驰 / `consolidation` 盘整背驰 |
| `area_ratio` | 一类的悬浮提示：「MACD 面积比 0.78」（越小背驰越明显） |

同一根K线可能同时有多个买卖点（例如二买和三买重合），标记文字合并显示即可。

### 5. 建议的界面控件

- 币种 / 周期 / 根数选择
- 显示开关：笔、线段、笔中枢、线段中枢、笔级别买卖点、线段级别买卖点（默认全开，K线多时可关掉笔）
- 笔模式切换：老笔 `strict` / 新笔 `loose`
- 可选：日期选择 → `end_time`，回看某个历史时刻接口当时会给出什么

---

## 字段说明

**笔 / 线段公共字段**

| 字段 | 说明 |
|---|---|
| `index` | 序号；中枢的 `item_*`、买卖点的 `item_index` 引用它 |
| `direction` | `up` / `down` |
| `start_time` / `start_price` / `end_time` / `end_price` | 起止点 |
| `high` / `low` | 区间最高 / 最低 |
| `raw_start` / `raw_end` | 起止点在 `klines` 中的下标 |
| `macd_area` | 同向 MACD 柱面积（背驰比较用） |
| `is_confirmed` | 终点是否已确定 |

线段额外字段：`bi_start` / `bi_end`（包含的笔序号）、`end_case`（`no_gap` 特征序列第一种情况 / `gap` 第二种情况）。

**中枢**

| 字段 | 说明 |
|---|---|
| `zg` / `zd` | 上沿 / 下沿（前三段高点最小值 / 低点最大值） |
| `gg` / `dd` | 中枢内最高 / 最低 |
| `start_time` / `end_time` | 时间范围 |
| `item_start` / `item_end` | 构成中枢的笔（线段中枢则为线段）序号 |
| `entry_item` / `exit_item` / `leave_item` | 进入段 / 离开段 / 离开后第一段不回中枢的走势 |
| `is_completed` | 是否已结束 |

**买卖点**

| 字段 | 说明 |
|---|---|
| `level` | `bi` 笔级别 / `seg` 线段级别 |
| `type` / `side` | `1` `2` `3` / `buy` `sell` |
| `time` / `price` / `raw_index` | 位置（= 所在笔或线段的终点） |
| `item_index` / `center_index` | 所在笔或线段序号、关联中枢序号（按 `level` 对应 `bis`/`segments`、`bi_centers`/`seg_centers`） |
| `is_confirmed` | 所在笔或线段终点已确定 |
| `divergence_type` / `area_ratio` | 仅一类 |
| `ref_item` | 仅二类：对应一类买卖点所在走势序号 |

## 判定规则

- **一买**：向下离开段跌破中枢最低点和进入段低点，且 MACD 绿柱面积 < 进入段 × `divergence_ratio`（一卖镜像）
- **二买**：一买之后第一次回调的低点不破一买
- **三买**：中枢向上离开后，第一段不回到中枢的回抽，低点 > ZG（三卖镜像：高点 < ZD）

## 时效

买卖点画在极值处，但要等**下一笔成立**才确认，实际能看到时已经晚了若干根K线（笔级别中位约 10~14 根，线段级别 25~80 根）。
笔级别已确认的买卖点不会重绘；线段级别偶有修正。
