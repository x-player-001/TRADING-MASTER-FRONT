# 看盘行情中转 API

服务器代拉币安 U 本位合约公开行情，供连不上币安的前端做实时看盘（类 TradingView）。

- 历史 K 线：`GET /api/market/klines`（服务器内存缓存）
- 实时 K 线：WebSocket `/ws/market`（含未收盘 K 线，约 250ms 一次）
- 不读写数据库，与 `trend` / `paper` / `live` 进程无关；挂在 `api` 进程上

所有时间戳为 **UTC 毫秒**，北京时间显示（+8 小时）由前端处理。

## 鉴权

服务器 `.env` 设置了 `MARKET_RELAY_TOKEN` 时，REST 和 WS 都要带 token：

- REST：`?token=xxx` 或请求头 `X-Relay-Token: xxx`
- WS：`/ws/market?token=xxx`

未设置时不校验。

## K 线数据结构（REST 与 WS 一致）

```json
{
  "symbol": "BTCUSDT",
  "interval": "1m",
  "open_time": 1760850000000,
  "close_time": 1760850059999,
  "open": 67000.1,
  "high": 67050,
  "low": 66980.5,
  "close": 67020.3,
  "volume": 152.33,
  "trade_count": 2041,
  "is_final": false
}
```

`is_final` 表示这根 K 线是否已经收盘，`false` 表示还在跳动。

支持的周期：`1m 3m 5m 15m 30m 1h 2h 4h 6h 8h 12h 1d 3d 1w 1M`。注意 `1M` 是月线，区分大小写。

## REST：历史 K 线

```
GET /api/market/klines?symbol=BTCUSDT&interval=1m&limit=500
```

| 参数 | 必填 | 说明 |
|---|---|---|
| symbol | 是 | 合约，如 `BTCUSDT`（大小写均可） |
| interval | 是 | 见上方周期列表 |
| limit | 否 | 1~1500，默认 500 |
| start_time | 否 | UTC 毫秒，返回 open_time ≥ 它的 K 线 |
| end_time | 否 | UTC 毫秒，返回 open_time ≤ 它的 K 线（往前翻页用） |

返回按时间升序，最后一根通常还没收盘：

```json
{ "success": true, "data": { "symbol": "BTCUSDT", "interval": "1m", "cache_hit": false, "klines": [ ... ] } }
```

缓存规则（前端不用管，了解即可）：
- 最后一根还没收盘的页（最新一页）缓存 3 秒。
- 全部已收盘的页（历史翻页）缓存 1 小时。

错误码：
- `400`：参数不合法，或币安拒绝请求（比如币种不存在）。
- `429`：服务器的币安权重接近上限。响应带 `Retry-After: 10`，稍后重试即可。
- `502`：上游请求失败。

## WebSocket：实时 K 线

```
ws(s)://<host>/ws/market
```

### 前端 → 后端

```json
{"op":"subscribe","streams":[{"symbol":"BTCUSDT","interval":"1m"}]}
{"op":"unsubscribe","streams":[{"symbol":"BTCUSDT","interval":"1m"}]}
{"op":"ping"}
```

一条连接可以订阅多个流（多图、多周期），最多 30 个。切换币种时，在同一条连接上先 `unsubscribe` 旧的、再 `subscribe` 新的，**不用断开重连**。

### 后端 → 前端

| type | 内容 | 说明 |
|---|---|---|
| `subscribed` | `streams` | 订阅回执。如果服务器已有该流的最新一根 K 线，会紧接着推一条 `kline` |
| `kline` | `data`: K 线 | 实时推送。按 `open_time` 判断：相同就更新最后一根，更新就追加一根 |
| `unsubscribed` | `streams` | 退订回执 |
| `resync` | `streams` | 服务器到币安的连接断过又重连了（币安每 24 小时会强制断开一次）。前端要对这些流用 REST 补拉断线期间的 K 线 |
| `pong` | — | 回应 `ping` |
| `error` | `message` | 参数错误、订阅数超限等 |

## 前端推荐流程

### 打开或切换图表

1. 先在 WS 上 `subscribe`，收到的 `kline` 暂存进缓冲区。
2. 调 REST 拉最新一页（`limit=500`），然后 `series.setData(...)`。
3. 把缓冲区里 `open_time` ≥ 历史最后一根的 K 线依次 `series.update(...)`，之后每收到一条直接 `update`。

先订阅再拉历史，可以避免两者之间漏掉 K 线。REST 最后一根未收盘的 K 线，会被后续推送自然覆盖。

### 往左拖加载更早数据

用 lightweight-charts 的 `subscribeVisibleLogicalRangeChange` 监听，可见范围接近最左端时：

```
GET /api/market/klines?symbol=..&interval=..&limit=500&end_time=<当前最早一根 open_time - 1>
```

把结果拼到数组前面，再 `setData`。

### 前端内存缓存（可选）

按 `symbol + interval` 缓存已经加载过的 K 线。切回来时只需要用 `start_time=<缓存最后一根 open_time>` 补拉，不用从头再拉。

### 收到 `resync`，或前端自己 WS 重连后

- 对相关流（自己重连的话就是全部流）调 REST：`start_time=<本地最后一根 open_time>`，用返回结果逐根 `update`。
- 前端自己重连后，要重新发一遍 `subscribe`。服务器不会记住断开的连接订阅过什么。

### 心跳与重连

- 服务器每 25 秒发一次 WS ping 帧。浏览器会自动回 pong，不用写代码。
- 前端也建议每 20 秒发一次 `{"op":"ping"}`。如果 10 秒内没收到 `pong`，就判定断线，主动关闭连接后重连。退避建议 1s → 2s → 5s，上限 10s。

## 前面有 Nginx 时

```nginx
location /ws/market {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
location /api/market/ {
    proxy_pass http://127.0.0.1:3000;
    gzip on;
    gzip_types application/json;
}
```

端口按实际 `PORT` 改。REST 开 gzip 对慢网络很有用，1000 根 K 线大约能压到原来的 1/5。

## 运行状态

```
GET /api/market/status
```

返回以下信息：
- 前端连接数、当前订阅的流、处于延迟退订期的流数。
- 上游连接状态：是否已连接、地址、已订阅流数、距上一条消息的时间。
- 缓存情况：页数、命中/未命中/拒绝次数、服务器当前已用权重。

## 服务器侧机制（实现说明）

- 到币安只开**一条**组合连接，用 `SUBSCRIBE` / `UNSUBSCRIBE` 动态增减订阅。控制消息每 500ms 最多各发一条（币安上限 10 条/秒），每条最多 200 个流；总流数上限 1000（币安单连接上限 1024）。
- 多个前端看同一个流，只占一条上游订阅。引用归零后等 45 秒才真正退订，来回切换周期不会反复订阅、退订。
- 上游断线（包括 24 小时强制断开）后退避重连，重放全部订阅，并给相关前端发 `resync`。如果有订阅但 60 秒没收到消息，看门狗会强制重连。
- 上游地址默认用新版路由 `wss://fstream.binance.com/market/stream`，连续失败会回退到旧路由 `/stream`。可以用 `MARKET_RELAY_WS_URL` 覆盖。
- 服务器 IP 和 `trend` / `live` 共用币安权重额度。已用权重超过 1500/2400 时，未命中缓存的历史请求返回 429，保证实盘不受影响。

实现：`src/services/market_relay/`、`src/api/binance_market_data_api.ts`、`src/api/routes/market_routes.ts`
单测：`tests/market_relay/`（含假币安上游的端到端测试）
服务器验证：`npx ts-node -r tsconfig-paths/register scripts/dev/verify/verify_market_relay.ts`
