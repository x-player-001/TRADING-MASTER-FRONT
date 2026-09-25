import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReplayAccount, ReplayOrderInput } from '../../services/kline_replay/replay_account';
import { calc_unrealized_pnl } from '../../services/kline_replay/replay_matching_engine';
import type { ReplayBar as EngineBar } from '../../services/kline_replay/replay_types';
import {
  replayAPI,
  ReplayBar,
  ReplayEvent,
  ReplayFill,
  ReplayInterval,
  ReplayOrder,
  ReplayPosition,
  ReplaySessionRow,
  ReplaySessionState,
  REPLAY_INTERVALS,
  INTERVAL_MS,
} from '../../services/replayAPI';

// ===== K线回放运行时 =====
// 前端揭示K线并撮合（ReplayAccount），后端只下发数据和存储：
//   历史 = /klines?end_time=游标；未来 = /bars?after= 预取到缓冲区（不渲染），推进时从缓冲区取出本地撮合；
//   交易记录和进度通过 /sync 串行上传。

export type BarsMap = Record<ReplayInterval, ReplayBar[]>;
export type StopOn = 'none' | 'fill' | 'position_closed';
export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface OpenPosition extends ReplayPosition {
  unrealized_pnl: number;
  /** (浮盈 − 已付手续费) / 计划风险；没设止损时为 null */
  unrealized_r: number | null;
}

/** 给页面和面板用的只读视图 */
export interface ReplayView {
  session: ReplaySessionRow;
  current_bar: EngineBar;
  equity: number;
  unrealized_pnl: number;
  position: OpenPosition | null;
  pending_orders: ReplayOrder[];
}

const EMPTY_BARS: BarsMap = { '5m': [], '15m': [], '1h': [], '4h': [] };
const INITIAL_LIMIT: Record<ReplayInterval, number> = { '5m': 1000, '15m': 800, '1h': 500, '4h': 300 };
const BASE_MS = INTERVAL_MS['5m'];
const CHUNK = 600;           // 每次预取的 5m 根数
const MAX_CHUNK = 2000;      // 接口上限
const PREFETCH_BELOW = 100;  // 缓冲区少于这么多就预取下一块
const MAX_KEEP = 4000;       // 图表最多保留的K线
const TRIM_SLACK = 500;      // 超出 MAX_KEEP 这么多才裁一次，避免每步都整段重绘
const SYNC_EVERY_MS = 5000;  // 纯推进时的同步间隔

const trim = (arr: ReplayBar[]) => (arr.length > MAX_KEEP + TRIM_SLACK ? arr.slice(arr.length - MAX_KEEP) : arr);

/**
 * 把新揭示的 5m 追加到各周期：5m 直接追加，大周期按桶聚合（桶起点 = floor(open_time / 周期) × 周期），
 * 更新或新开最后一根，桶内最后一根 5m 到了就标记收盘
 */
const applyNewBars = (prev: BarsMap, newBars: EngineBar[]): BarsMap => {
  if (newBars.length === 0) return prev;
  const next: BarsMap = { ...prev, '5m': trim([...prev['5m'], ...newBars]) };
  for (const iv of REPLAY_INTERVALS) {
    if (iv === '5m') continue;
    const ms = INTERVAL_MS[iv];
    const arr = prev[iv].slice();
    for (const b of newBars) {
      const bucket = Math.floor(b.open_time / ms) * ms;
      const closed = b.open_time + BASE_MS >= bucket + ms;
      const last = arr[arr.length - 1];
      if (last && last.open_time === bucket) {
        arr[arr.length - 1] = {
          ...last,
          high: Math.max(last.high, b.high),
          low: Math.min(last.low, b.low),
          close: b.close,
          volume: last.volume + b.volume,
          is_closed: closed,
        };
      } else {
        if (last && last.is_closed === false) arr[arr.length - 1] = { ...last, is_closed: true };
        arr.push({
          open_time: bucket,
          close_time: bucket + ms - 1,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
          is_closed: closed,
        });
      }
    }
    next[iv] = trim(arr);
  }
  return next;
};

const hasTradeEvent = (events: ReplayEvent[]) => events.some((e) => e.type !== 'gap');

interface Options {
  /** 撮合事件（成交、平仓、拒单、缺口…），页面用来弹提示 */
  onEvents?: (events: ReplayEvent[]) => void;
}

export function useReplaySession({ onEvents }: Options = {}) {
  const accountRef = useRef<ReplayAccount | null>(null);
  const sessionRef = useRef<ReplaySessionRow | null>(null);
  const cursorRef = useRef<EngineBar | null>(null);
  const bufferRef = useRef<EngineBar[]>([]);
  const eofRef = useRef(false);
  const fetchingRef = useRef<Promise<void> | null>(null);
  const busyRef = useRef(false);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  // 同步状态
  const revisionRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const syncPendingRef = useRef<'none' | 'progress' | 'full'>('none');
  const tradesDirtyRef = useRef(false);
  const progressDirtyRef = useRef(false);

  const [bars, setBars] = useState<BarsMap>(EMPTY_BARS);
  const [version, setVersion] = useState(0); // account 是可变对象，改完递增触发重算视图
  const [loading, setLoading] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [statsKey, setStatsKey] = useState(0); // 完整同步成功后递增，统计页据此重新拉取
  const [bufferEmpty, setBufferEmpty] = useState(false);

  const bump = () => setVersion((v) => v + 1);

  // ── 同步 ──
  const buildPayload = useCallback((kind: 'progress' | 'full') => {
    const account = accountRef.current!;
    const session = sessionRef.current!;
    const cursor = cursorRef.current!;
    const progress = {
      cursor_time: cursor.open_time,
      last_price: cursor.close,
      bars_stepped: session.bars_stepped,
      status: session.status,
    };
    revisionRef.current += 1;
    return kind === 'full'
      ? account.to_sync_payload(progress, revisionRef.current)
      : { revision: revisionRef.current, progress: { ...progress, balance: account.state.balance } };
  }, []);

  /** 返回本次是否已入库（409 视为已有更新版本，也算成功）；排队未发的返回 true */
  const runSync = useCallback(async (kind: 'progress' | 'full'): Promise<boolean> => {
    const session = sessionRef.current;
    if (!session || !accountRef.current || !cursorRef.current) return true;
    if (syncInFlightRef.current) {
      // 串行：记下来，等本次返回后再发（full 覆盖 progress）
      if (kind === 'full' || syncPendingRef.current === 'none') syncPendingRef.current = kind;
      return true;
    }
    syncInFlightRef.current = true;
    setSyncStatus('syncing');
    const payload = buildPayload(kind);
    const wasTradesDirty = tradesDirtyRef.current;
    if (kind === 'full') tradesDirtyRef.current = false;
    progressDirtyRef.current = false;

    const res = await replayAPI.sync(session.id, payload);
    if (res.ok) {
      setSyncStatus('idle');
      setSyncError(null);
      if (kind === 'full') setStatsKey((k) => k + 1);
    } else if (res.conflict) {
      // 已有更新的版本入库：这次忽略，本地 revision 调到它之上
      revisionRef.current = Math.max(revisionRef.current, res.current_revision);
      setSyncStatus('idle');
    } else {
      if (kind === 'full') tradesDirtyRef.current = tradesDirtyRef.current || wasTradesDirty;
      progressDirtyRef.current = true;
      setSyncStatus('error');
      setSyncError(res.error);
    }
    syncInFlightRef.current = false;

    const pending = syncPendingRef.current;
    syncPendingRef.current = 'none';
    if (pending !== 'none') void runSync(pending);
    return res.ok || res.conflict;
  }, [buildPayload]);

  /** 有未同步内容就同步一次（暂停、离开时用） */
  const flush = useCallback(async () => {
    if (tradesDirtyRef.current) await runSync('full');
    else if (progressDirtyRef.current) await runSync('progress');
  }, [runSync]);


  // 纯推进：定时同步进度
  useEffect(() => {
    const timer = setInterval(() => {
      if (!sessionRef.current || syncInFlightRef.current) return;
      if (tradesDirtyRef.current) void runSync('full');
      else if (progressDirtyRef.current) void runSync('progress');
    }, SYNC_EVERY_MS);
    return () => clearInterval(timer);
  }, [runSync]);

  // 关页面：sendBeacon 发最后一次
  useEffect(() => {
    const onHide = () => {
      const session = sessionRef.current;
      if (!session || !accountRef.current || !cursorRef.current) return;
      if (!tradesDirtyRef.current && !progressDirtyRef.current) return;
      const sent = replayAPI.beaconSync(session.id, buildPayload(tradesDirtyRef.current ? 'full' : 'progress'));
      if (sent) {
        tradesDirtyRef.current = false;
        progressDirtyRef.current = false;
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      onHide(); // 组件卸载（切到别的页面）也补发一次
    };
  }, [buildPayload]);

  // ── 缓冲区 ──
  const fetchMore = useCallback((limit = CHUNK): Promise<void> => {
    if (fetchingRef.current) return fetchingRef.current;
    const session = sessionRef.current;
    if (!session || eofRef.current) return Promise.resolve();
    const buf = bufferRef.current;
    const after = buf.length ? buf[buf.length - 1].open_time : cursorRef.current!.open_time;
    const p = replayAPI
      .getBars(session.id, after, Math.min(limit, MAX_CHUNK))
      .then((chunk) => {
        if (sessionRef.current?.id !== session.id) return; // 期间切换了会话
        const last = bufferRef.current.length ? bufferRef.current[bufferRef.current.length - 1].open_time : after;
        bufferRef.current.push(...chunk.bars.filter((b) => b.open_time > last));
        eofRef.current = chunk.end_of_data;
        setBufferEmpty(eofRef.current && bufferRef.current.length === 0);
      })
      .finally(() => {
        fetchingRef.current = null;
      });
    fetchingRef.current = p;
    return p;
  }, []);

  // ── 打开 / 关闭会话 ──
  const reset = () => {
    accountRef.current = null;
    sessionRef.current = null;
    cursorRef.current = null;
    bufferRef.current = [];
    eofRef.current = false;
    fetchingRef.current = null;
    tradesDirtyRef.current = false;
    progressDirtyRef.current = false;
    syncPendingRef.current = 'none';
    setBars(EMPTY_BARS);
    setBufferEmpty(false);
    setSyncStatus('idle');
    setSyncError(null);
  };

  const open = useCallback(async (arg: number | ReplaySessionState) => {
    await flush();
    setLoading(true);
    try {
      const state = typeof arg === 'number' ? await replayAPI.getSession(arg) : arg;
      const { session, cursor_bar } = state;
      const klines = await Promise.all(
        REPLAY_INTERVALS.map((iv) => replayAPI.getKlines(session.id, iv, session.cursor_time, INITIAL_LIMIT[iv]))
      );
      reset();
      accountRef.current = new ReplayAccount(session, {
        positions: state.positions ?? [],
        orders: state.orders ?? [],
        fills: state.fills ?? [],
      });
      sessionRef.current = { ...session };
      cursorRef.current = cursor_bar;
      revisionRef.current = session.sync_revision ?? 0;
      const map = { ...EMPTY_BARS };
      REPLAY_INTERVALS.forEach((iv, i) => { map[iv] = klines[i]; });
      setBars(map);
      if (session.status === 'active') await fetchMore();
      bump();
      return session;
    } finally {
      setLoading(false);
    }
  }, [flush, fetchMore]);

  const close = useCallback(async () => {
    await flush();
    reset();
    bump();
  }, [flush]);

  // ── 推进 ──
  /** 推进 n 根 5m；stopOn 命中时提前停在那一根 */
  const step = useCallback(async (n: number, stopOn: StopOn = 'none'): Promise<{ events: ReplayEvent[]; endOfData: boolean } | null> => {
    const account = accountRef.current;
    const session = sessionRef.current;
    if (!account || !session || session.status !== 'active' || busyRef.current) return null;
    busyRef.current = true;
    setStepping(true);
    const events: ReplayEvent[] = [];
    const revealed: EngineBar[] = [];
    try {
      for (let i = 0; i < n; i++) {
        if (bufferRef.current.length === 0) {
          if (eofRef.current) break;
          await fetchMore(Math.max(CHUNK, n - i));
          if (bufferRef.current.length === 0) break;
        }
        const bar = bufferRef.current.shift()!;
        const prev = cursorRef.current!;
        const gapBars = Math.round((bar.open_time - prev.open_time) / BASE_MS) - 1;
        if (gapBars > 0) {
          events.push({ type: 'gap', from_time: prev.open_time, to_time: bar.open_time, missing_bars: gapBars });
        }
        const ev = account.process_bar(bar);
        events.push(...ev);
        revealed.push(bar);
        cursorRef.current = bar;
        session.bars_stepped += 1;
        if (stopOn === 'fill' && ev.some((e) => e.type === 'fill')) break;
        if (stopOn === 'position_closed' && ev.some((e) => e.type === 'position_closed')) break;
      }
    } finally {
      busyRef.current = false;
      setStepping(false);
    }

    if (revealed.length) {
      const cursor = cursorRef.current!;
      session.cursor_time = cursor.open_time;
      session.last_price = cursor.close;
      session.balance = account.state.balance;
      setBars((prev) => applyNewBars(prev, revealed));
      progressDirtyRef.current = true;
      if (hasTradeEvent(events)) {
        tradesDirtyRef.current = true;
        void runSync('full');
      }
    }
    const endOfData = eofRef.current && bufferRef.current.length === 0;
    setBufferEmpty(endOfData);
    if (!eofRef.current && bufferRef.current.length < PREFETCH_BELOW) void fetchMore();
    bump();
    if (events.length) onEventsRef.current?.(events);
    return { events, endOfData };
  }, [fetchMore, runSync]);

  // ── 交易操作（全部本地撮合，完成后立即同步） ──
  const afterTrade = useCallback((events: ReplayEvent[]) => {
    const account = accountRef.current;
    if (account && sessionRef.current) sessionRef.current.balance = account.state.balance;
    tradesDirtyRef.current = true;
    void runSync('full');
    bump();
    if (events.length) onEventsRef.current?.(events);
  }, [runSync]);

  const submitOrder = useCallback((input: ReplayOrderInput) => {
    const account = accountRef.current;
    const cursor = cursorRef.current;
    if (!account || !cursor || sessionRef.current?.status !== 'active') return null;
    const res = account.submit_order(input, cursor);
    afterTrade(res.events);
    return res;
  }, [afterTrade]);

  const cancelOrder = useCallback((clientId: string) => {
    const account = accountRef.current;
    if (!account) return;
    afterTrade(account.cancel_order(clientId));
  }, [afterTrade]);

  /** undefined=不改，null=清除；返回错误信息或 null */
  const setProtection = useCallback((sl: number | null | undefined, tp: number | null | undefined): string | null => {
    const account = accountRef.current;
    const cursor = cursorRef.current;
    if (!account || !cursor) return '会话未打开';
    const error = account.set_protection(sl, tp, cursor);
    if (!error) afterTrade([]);
    return error;
  }, [afterTrade]);

  const closePosition = useCallback((qty?: number): string | null => {
    const account = accountRef.current;
    const cursor = cursorRef.current;
    if (!account || !cursor) return '会话未打开';
    const { error, events } = account.close_position(cursor, qty ?? null);
    if (!error) afterTrade(events);
    return error;
  }, [afterTrade]);

  const updateJournal = useCallback((positionClientId: string, patch: { tags?: string[]; note?: string | null }) => {
    const account = accountRef.current;
    if (!account) return;
    account.update_journal(positionClientId, patch);
    tradesDirtyRef.current = true;
    void runSync('full');
    bump();
  }, [runSync]);

  /** 结束会话：本地平仓撤单，再以 finished 状态同步（等同步完成再返回，结果为是否同步成功） */
  const finish = useCallback(async (): Promise<boolean> => {
    const account = accountRef.current;
    const cursor = cursorRef.current;
    const session = sessionRef.current;
    if (!account || !cursor || !session) return false;
    const events = account.finish(cursor);
    session.status = 'finished';
    session.balance = account.state.balance;
    tradesDirtyRef.current = true;
    bump();
    if (events.length) onEventsRef.current?.(events);
    // 可能有同步在途：等它结束后再发 finished 这一份
    while (syncInFlightRef.current) await new Promise((r) => setTimeout(r, 100));
    return runSync('full');
  }, [runSync]);

  // ── 派生视图 ──
  const view = useMemo<ReplayView | null>(() => {
    const account = accountRef.current;
    const session = sessionRef.current;
    const cursor = cursorRef.current;
    if (!account || !session || !cursor) return null;
    const pos = account.state.position;
    const upnl = calc_unrealized_pnl(pos, cursor.close);
    const position: OpenPosition | null = pos
      ? {
          ...pos,
          unrealized_pnl: upnl,
          unrealized_r: pos.risk_amount && pos.risk_amount > 0 ? (upnl - pos.fee_total) / pos.risk_amount : null,
        }
      : null;
    return {
      session: { ...session, balance: account.state.balance },
      current_bar: cursor,
      equity: account.get_equity(cursor.close),
      unrealized_pnl: upnl,
      position,
      pending_orders: [...account.state.orders],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const fills = useMemo<ReplayFill[]>(
    () => (accountRef.current ? [...accountRef.current.fills] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const positions = useMemo<ReplayPosition[]>(
    () => (accountRef.current ? [...accountRef.current.positions.values()].sort((a, b) => b.open_bar_time - a.open_bar_time) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  return {
    view,
    bars,
    fills,
    positions,
    loading,
    stepping,
    endOfData: bufferEmpty,
    syncStatus,
    syncError,
    statsKey,
    open,
    close,
    step,
    flush,
    submitOrder,
    cancelOrder,
    setProtection,
    closePosition,
    updateJournal,
    finish,
  };
}
