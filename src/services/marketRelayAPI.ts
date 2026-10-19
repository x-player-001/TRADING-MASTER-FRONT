/**
 * 看盘行情中转（后端代拉币安 U 本位合约公开行情）
 *
 * - 历史 K 线：GET /api/market/klines
 * - 实时 K 线：WS /ws/market（含未收盘 K 线，约 250ms 一次）
 *
 * 协议见 docs/MARKET_RELAY_API.md。时间戳均为 UTC 毫秒，+8 小时由图表层处理。
 */
import { API_BASE_URL } from './apiClient';

export interface RelayKline {
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

export const RELAY_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'] as const;
export type RelayInterval = (typeof RELAY_INTERVALS)[number];

export const INTERVAL_MS: Record<RelayInterval, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_678_400_000, // 月线长度不固定，只用于粗略判断缺口
};

export const isRelayInterval = (v: string): v is RelayInterval => (RELAY_INTERVALS as readonly string[]).includes(v);

const TOKEN: string = import.meta.env.VITE_MARKET_RELAY_TOKEN || '';

// ── REST ──

export interface KlineQuery {
  symbol: string;
  interval: RelayInterval;
  limit?: number;
  start_time?: number;
  end_time?: number;
}

/** 直接用 fetch：需要拿到 429 的 Retry-After，apiClient 会把状态码吞掉 */
export async function fetchRelayKlines(q: KlineQuery, retries = 2): Promise<RelayKline[]> {
  const params = new URLSearchParams({ symbol: q.symbol, interval: q.interval, limit: String(q.limit ?? 500) });
  if (q.start_time !== undefined) params.set('start_time', String(q.start_time));
  if (q.end_time !== undefined) params.set('end_time', String(q.end_time));
  if (TOKEN) params.set('token', TOKEN);

  const res = await fetch(`${API_BASE_URL}/api/market/klines?${params}`);
  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get('Retry-After') || 10) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return fetchRelayKlines(q, retries - 1);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error || `行情请求失败 (HTTP ${res.status})`);
  }
  return body.data.klines as RelayKline[];
}

/** 全市场行情（WS subscribe_tickers 推送）。涨跌幅是百分数（3.25 = +3.25%），窗口数据不足时为 null */
export interface LiveTicker {
  symbol: string;
  last_price: number;
  change_1h: number | null;
  change_4h: number | null;
  change_24h: number | null;
  quote_volume_24h: number | null;
}

export interface TickersMessage {
  /** true：全量，替换本地整张表；false：增量，按 symbol 覆盖 */
  full: boolean;
  rows: LiveTicker[];
  /** 下架 / 停牌，从本地表删除 */
  removed: string[];
}

/** 推送每行是按 fields 顺序排列的数组，还原成对象 */
const parseTickers = (msg: any): TickersMessage => {
  const fields: string[] = msg.fields ?? [];
  const rows = (msg.data ?? []).map((arr: unknown[]) => {
    const row: Record<string, unknown> = {};
    fields.forEach((f, i) => { row[f] = arr[i] ?? null; });
    return row as unknown as LiveTicker;
  });
  return { full: Boolean(msg.full), rows, removed: msg.removed ?? [] };
};

// ── WebSocket ──

export type RelayStatus = 'connecting' | 'open' | 'closed';

export interface RelayListener {
  onKline?: (k: RelayKline) => void;
  onTickers?: (msg: TickersMessage) => void;
  /** 这些流可能漏了 K 线，需要用 REST 补拉（服务器上游重连，或本地 WS 重连） */
  onResync?: (streams: { symbol: string; interval: string }[]) => void;
  onStatus?: (status: RelayStatus) => void;
  onError?: (message: string) => void;
}

const streamKey = (symbol: string, interval: string) => `${symbol.toUpperCase()}|${interval}`;
const keyToRef = (key: string) => {
  const [symbol, interval] = key.split('|');
  return { symbol, interval };
};

const wsUrl = () => {
  let base: string = import.meta.env.VITE_WS_URL || '';
  if (!base) {
    base = API_BASE_URL ? API_BASE_URL.replace(/^http/, 'ws') : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  }
  return `${base.replace(/\/$/, '')}/ws/market${TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ''}`;
};

const PING_EVERY_MS = 20_000;
const PONG_TIMEOUT_MS = 10_000;
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000];
/** 没有订阅后多久断开连接（页面间来回切换时不反复建连） */
const IDLE_CLOSE_MS = 30_000;

/** 全局共享一条 WS：多个图表按流做引用计数 */
class MarketRelaySocket {
  private ws: WebSocket | null = null;
  private status: RelayStatus = 'closed';
  private readonly refs = new Map<string, number>();
  /** 全市场行情订阅的引用计数（不占 K 线流名额） */
  private tickerRefs = 0;
  private readonly listeners = new Set<RelayListener>();
  private attempt = 0;
  private hasOpened = false;
  private reconnectTimer: number | undefined;
  private pingTimer: number | undefined;
  private pongTimer: number | undefined;
  private idleTimer: number | undefined;

  getStatus(): RelayStatus {
    return this.status;
  }

  addListener(l: RelayListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** 订阅一条流，返回退订函数 */
  subscribe(symbol: string, interval: string): () => void {
    const key = streamKey(symbol, interval);
    const n = this.refs.get(key) ?? 0;
    this.refs.set(key, n + 1);
    window.clearTimeout(this.idleTimer);
    if (n === 0) this.send({ op: 'subscribe', streams: [keyToRef(key)] });
    this.ensureConnected();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (this.refs.get(key) ?? 1) - 1;
      if (left > 0) {
        this.refs.set(key, left);
        return;
      }
      this.refs.delete(key);
      this.send({ op: 'unsubscribe', streams: [keyToRef(key)] });
      this.closeIfIdle();
    };
  }

  /** 订阅全市场行情（先推全量，之后每 2 秒推增量），返回退订函数 */
  subscribeTickers(): () => void {
    this.tickerRefs++;
    window.clearTimeout(this.idleTimer);
    if (this.tickerRefs === 1) this.send({ op: 'subscribe_tickers' });
    this.ensureConnected();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.tickerRefs--;
      if (this.tickerRefs > 0) return;
      this.send({ op: 'unsubscribe_tickers' });
      this.closeIfIdle();
    };
  }

  private hasSubscriptions() {
    return this.refs.size > 0 || this.tickerRefs > 0;
  }

  private closeIfIdle() {
    if (!this.hasSubscriptions()) {
      this.idleTimer = window.setTimeout(() => this.close(), IDLE_CLOSE_MS);
    }
  }

  private ensureConnected() {
    if (this.ws || this.reconnectTimer !== undefined) return;
    this.connect();
  }

  private connect() {
    this.reconnectTimer = undefined;
    this.setStatus('connecting');
    const ws = new WebSocket(wsUrl());
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.attempt = 0;
      this.setStatus('open');
      const streams = [...this.refs.keys()].map(keyToRef);
      if (streams.length) ws.send(JSON.stringify({ op: 'subscribe', streams }));
      // 重连后重新订阅全市场行情，服务器会再推一次全量
      if (this.tickerRefs > 0) ws.send(JSON.stringify({ op: 'subscribe_tickers' }));
      // 重连：断线期间的 K 线需要补拉
      if (this.hasOpened && streams.length) this.emit((l) => l.onResync?.(streams));
      this.hasOpened = true;
      this.startPing();
    };

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg?.type) {
        case 'kline':
          this.emit((l) => l.onKline?.(msg.data));
          break;
        case 'tickers':
          {
            const parsed = parseTickers(msg);
            this.emit((l) => l.onTickers?.(parsed));
          }
          break;
        case 'resync':
          this.emit((l) => l.onResync?.(msg.streams ?? []));
          break;
        case 'pong':
          window.clearTimeout(this.pongTimer);
          break;
        case 'error':
          this.emit((l) => l.onError?.(msg.message));
          break;
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.dropSocket();
      if (!this.hasSubscriptions()) {
        this.setStatus('closed');
        return;
      }
      this.setStatus('connecting');
      const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
      this.attempt++;
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  private startPing() {
    window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (!this.send({ op: 'ping' })) return;
      window.clearTimeout(this.pongTimer);
      // 10 秒没回 pong：判定断线，主动关闭触发重连
      this.pongTimer = window.setTimeout(() => this.ws?.close(), PONG_TIMEOUT_MS);
    }, PING_EVERY_MS);
  }

  private dropSocket() {
    window.clearInterval(this.pingTimer);
    window.clearTimeout(this.pongTimer);
    this.ws = null;
  }

  private close() {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const ws = this.ws;
    this.dropSocket();
    ws?.close();
    this.hasOpened = false;
    this.setStatus('closed');
  }

  private send(msg: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private setStatus(s: RelayStatus) {
    if (this.status === s) return;
    this.status = s;
    this.emit((l) => l.onStatus?.(s));
  }

  private emit(fn: (l: RelayListener) => void) {
    this.listeners.forEach((l) => {
      try {
        fn(l);
      } catch (err) {
        console.error('[MarketRelay] listener error', err);
      }
    });
  }
}

export const marketRelaySocket = new MarketRelaySocket();
