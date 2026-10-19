# 龙头榜 API

**分工：榜单与进榜事件由服务器上的 pm2 `leaders` 进程每根 15m 收盘后自动计算，API 只读，前端负责展示。**
与趋势跟随观察列表「共振」时，`leaders` 进程会推送企业微信（每个币 24h 内只推一次）。

前缀 `/api/leaders`。所有响应形如 `{ success: true, data }`；出错返回 `{ success: false, error }`。
时间均为毫秒时间戳（UTC），前端显示时自行转北京时间。

## 口径

| 项 | 规则 |
|---|---|
| 排名频率 | 每根 15m 收盘（收盘后约 90 秒算完） |
| 相对量 `rvol` | 窗口成交额 ÷ 同长度基准；基准 = max(前 20 个完整日成交额中位数, 5M)，至少 3 天历史 |
| 窗口 | `24h`：滚动 24h 成交额，主榜；`4h`：滚动 4h 成交额，「刚启动」榜（约提前 8 小时发现，但误报多） |
| 上榜门槛 | 24h 成交额 ≥20M（4h 窗口按 1/6）、相对量 ≥3，取前 6；不够 6 个就宁缺毋滥 |
| 进榜事件 | 前 5 天未在榜 → 新一轮；断档 ≤1 小时算连续在榜；5 天内再上榜算同一轮的「再次上榜」 |
| 第一波高点 | 首次进榜前 24h 起至掉榜确认时的最高价，掉榜确认后冻结 |
| 掉榜确认 | 连续 1 小时以上不在榜 |
| 第二波 | 掉榜后最高价 ≥ 第一波高点 × 1.1 |
| 观察期 | 最后一次在榜后 10 天，过后事件过期 |

基准设下限而不是直接排除冷门币，是为了不漏掉「冷门币突然被点燃」的龙头（例：AGT 10-16 日成交额 455M，平时 3.6M）。

### 研究结论（2026-01 ~ 10，904 次进榜，用来理解看板，不是交易信号）

- 进榜时 24h 平均已经涨了 28%（中位数），**按进榜价持有，中位数亏损**（1 / 5 / 20 天后分别 -5% / -11% / -17%）→ 榜单告诉你钱在哪，不是入场点
- 掉榜后 20 天内出现第二波的比例约 30%；第二波距第一波高点中位 4.7 天，73% 在 10 天内；突破前通常先回撤约 25%
- 一轮游的币从高点平均回撤约 45%
- 第二波更多：拉升前 30 天本来就在强上升趋势、掉榜后量能还在、平时成交额较大、反复上榜的老龙头；回撤期 OI 基本持平
- 第二波更少：极端放量的冷门币（相对量 >58）、量能迅速退潮、第一波 OI 翻倍（杠杆过热）、峰后 OI 降超 30%（资金撤离）、负资金费率

## 阶段 `phase`

| phase | phase_label | 含义 |
|---|---|---|
| `first_wave` | 第一波在榜 | 首次进榜后还在榜 |
| `relisted` | 再次上榜 | 掉榜后 5 天内又上榜（第一波高点已冻结） |
| `pullback` | 回撤观察 | 掉榜后、尚未出现第二波 → **第二波观察区的主体** |
| `second_wave` | 已二次新高 | 掉榜后已超出第一波高点 10% |
| `expired` | 已过期 | 最后一次在榜后超过 10 天 |

## 评估 `evaluation`

| 字段 | 含义 |
|---|---|
| `drawdown_from_peak` | 当前价距第一波高点（-0.15 = 低 15%） |
| `hours_since_peak` | 距第一波高点所在 15m 收盘的小时数 |
| `days_since_dropout` | 掉榜确认后的天数（未掉榜为 null） |
| `volume_decay` | 当前 24h 成交额 ÷ 在榜期间最大 24h 成交额 |
| `oi_wave` | 第一波 OI 变化（起涨时 → 第一波高点时） |
| `oi_pull` | 峰后 OI 变化（第一波高点时 → 现在，掉榜后才有） |
| `funding_rate` | 当前资金费率（币安 premiumIndex `lastFundingRate`） |
| `tags` | 有利标签：`强上升趋势`（拉升前 30 天涨 >28%）`量能在`（volume_decay ≥0.67）`有底子`（基准 ≥7M）`老龙头`（前 60 天上榜 ≥3 轮）`多头留存`（\|oi_pull\| ≤10%） |
| `risk_tags` | 风险标签：`冷门暴量`（最大相对量 >58）`量能退潮`（volume_decay <0.23）`杠杆过热`（oi_wave ≥100%）`资金撤离`（oi_pull < -30%）`空头占优`（资金费率 ≤ -0.01%）`窗口后段`（掉榜超 5 天仍无第二波） |
| `tier` | 第二波参考档位 `high` / `mid` / `low`，**只在 `pullback` 阶段给出**，其余为 null |
| `score` | 档位的打分 |

档位按研究的单特征分组打分：距峰回撤越小越高（离高点近更容易碰到，有一半是机械效应）、峰后超 36 小时扣分、有利标签加分、`冷门暴量`/`量能退潮` 扣分。
OI 与资金费率在研究里没有提升样本外判断力，所以只作为标签展示、不计入档位。
研究中按同样思路训练的模型，预测概率最低一档实际约 11%、最高一档约 55%，基础概率约 30%。

## 共振

`resonance = true` 表示该币同时在趋势跟随观察列表里（`GET /api/trend-follow/watchlist` 默认 15m / 1h / 4h），`watchlist` 字段附观察列表摘要：

```json
{ "timeframes": ["4h"], "stage": "PULLBACK", "retrace_now": 0.34, "score": 2, "score_tags": ["回调中"] }
```

企业微信推送条件：在榜（任一窗口）或 24h 榜回撤观察中，且在观察列表里；同一个币 24h 内只推一次，两个窗口同时满足时推 24h。

---

## GET /api/leaders/board

当前榜单。

| 参数 | 说明 |
|---|---|
| `window` | `24h`（默认）/ `4h` |

```json
{
  "success": true,
  "data": {
    "window": "24h",
    "bar_time": 1792373400000,
    "items": [
      {
        "rank": 2, "symbol": "QUSDT", "rvol": 43.1, "rolling_qv": 1134000000, "close": 0.1116, "change_24h": -0.09,
        "episode": { "...": "见下方事件字段" },
        "watchlist": { "timeframes": ["1h"], "stage": "PULLBACK", "retrace_now": 0.32, "score": 1, "score_tags": ["回调中"] },
        "resonance": true
      }
    ]
  }
}
```

| 字段 | 含义 |
|---|---|
| `bar_time` | 榜单对应的 15m 收盘时刻 |
| `rvol` | 相对量 |
| `rolling_qv` | 窗口成交额（USDT） |
| `change_24h` | 24h 涨跌 |
| `episode` | 该币该窗口当前的进榜事件（字段同 `/episodes`） |

## GET /api/leaders/episodes

进榜事件列表，默认返回未过期的全部阶段，即「第二波观察区」。
排序：共振在前 → 阶段（再次上榜、第一波在榜、回撤观察、已二次新高）→ 档位 → 最近在榜时间。

| 参数 | 说明 |
|---|---|
| `window` | `24h`（默认）/ `4h` / `all` |
| `phase` | 逗号分隔，如 `pullback,second_wave`；默认除 `expired` 外全部 |
| `resonance_only` | `true` 只返回共振 |
| `days` | 含 `expired` 时回看天数（按最后更新时间，默认 10） |

## GET /api/leaders/symbol/:symbol

单币进榜历史（两个窗口，含已过期，最近 50 条），`symbol` 不区分大小写。

## 事件字段

| 字段 | 含义 |
|---|---|
| `id` / `symbol` / `window` | 事件 id、币种、窗口 |
| `status` | `listed` 在榜 / `watching` 掉榜观察 / `expired` 过期 |
| `phase` / `phase_label` | 阶段（见上） |
| `first_entry_time` | **首次进榜**时刻（15m 收盘） |
| `streak_start_time` | **本轮进榜**（这次连续在榜的起点） |
| `last_listed_time` | 最近一次在榜 |
| `listed_hours` | 本轮已在榜小时数 |
| `entry_price` / `entry_change_24h` / `entry_rvol` | 首次进榜价、进榜时 24h 涨跌、进榜时相对量 |
| `change_since_entry` | 现价较首次进榜价 |
| `listed_bars` / `relist_count` | 累计在榜 15m 根数、再次上榜次数 |
| `last_rank` / `last_rvol` | 当前排名与相对量（不在榜为 null） |
| `rvol_max` / `rolling_qv_max` | 在榜期间最大相对量 / 最大 24h 成交额 |
| `peak_price` / `peak_time` | 第一波高点及所在 15m K线 open_time |
| `dropout_time` | 首次掉榜确认时刻 |
| `pullback_low` | 掉榜后、第二波之前的最低价 |
| `max_high_after` | 掉榜后最高价 |
| `second_wave_time` | 第二波（超出高点 10%）所在 15m K线 open_time |
| `last_price` / `last_time` / `last_rolling_qv` | 现价、更新时刻、当前 24h 成交额 |
| `baseline_qv` | 进榜时基准（含 5M 下限） |
| `pre_trend30` | 拉升前 30 天涨跌（日线） |
| `prior_episodes_60d` | 首次进榜前 60 天上榜轮数（随运行时间累积，上线初期偏少） |
| `market` | `{ oi_start, oi_peak, oi_now, funding_rate, updated_at }`，OI 为张数（openInterestHist 1h），每轮刷新 |
| `resonance_notified_at` | 推送企业微信的时刻（未推送为 null） |
| `evaluation` | 见「评估」 |
| `watchlist` / `resonance` | 见「共振」 |

## 运维

- 进程：pm2 `leaders`（`scripts/run_leader_board.ts`），`--once` 跑一轮后退出
- 数据：trend 写入的 `kline_5m_YYYYMMDD`（增量读）+ daily-breakout 回填的 `kline_1d_agg`（基准、30 天趋势）；OI / 资金费率走币安 REST
- 表：`leader_board_snapshots`（每根 15m 两个窗口的榜单，保留 60 天）、`leader_episodes`
- 重启从最后一次快照后逐根补算（最多 2 天）；首次运行回补 7 天
- 推送开关：`LEADER_RESONANCE_PUSH=false` 关闭；企业微信本身受 `WECOM_ENABLED` 控制
