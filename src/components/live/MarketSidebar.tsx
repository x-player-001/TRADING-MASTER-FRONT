import React, { useEffect, useRef, useState } from 'react';
import { Segmented } from 'antd';
import SymbolWatchlist, { SymbolGroup } from './SymbolWatchlist';
import { trendFollowAPI, WatchlistItem, WATCH_STAGE_LABELS } from '../../services/trendFollowAPI';
import { leaderAPI, LeaderBoard, LeaderBoardItem } from '../../services/leaderAPI';
import { marketRelaySocket, LiveTicker } from '../../services/marketRelayAPI';
import styles from './MarketSidebar.module.scss';

type Tab = 'fav' | 'watch' | 'leader' | 'gainers';

interface MarketSidebarProps {
  favorites: string[];
  current: string;
  onSelect: (symbol: string) => void;
  onRemoveFavorite: (symbol: string) => void;
  /** 每个列表最多订阅多少个币的实时价（WS 单连接最多 30 条流） */
  maxRows: number;
  /** 全部列表里的币（去重，用于后台预拉 K 线） */
  onSymbolsChange?: (symbols: string[]) => void;
}

const TAB_KEY = 'liveMarket.sidebarTab';
/** 观察列表与趋势跟随页同频；龙头榜每根 15m 才更新一次 */
const WATCH_POLL_MS = 30_000;
const LEADER_POLL_MS = 120_000;
/** 涨幅榜：WS 推送全市场行情（只占一个订阅，不计入 K 线流上限），本地排序后取前 N */
const GAINERS_TOP = 5;
/** 观察列表数量不固定，只预拉评分最高的这么多个 */
const WATCH_PREFETCH_MAX = 20;
/** 服务器每 2 秒推一次增量，攒一批再重排 */
const GAINERS_RANK_MS = 1_000;
/** 24h 成交额下限，过滤冷门币（与龙头榜门槛一致） */
const GAINERS_MIN_QUOTE_VOLUME = 20_000_000;
const GAINER_WINDOWS = ['1h', '4h', '24h'] as const;
type GainerWindow = (typeof GAINER_WINDOWS)[number];
type GainerBoard = Record<GainerWindow, LiveTicker[]>;

/** 本地全表 → 各周期涨幅前 N（成交额不够、涨幅为 null 的不参与） */
const rankGainers = (table: Map<string, LiveTicker>): GainerBoard => {
  const liquid = [...table.values()].filter((t) => (t.quote_volume_24h ?? 0) >= GAINERS_MIN_QUOTE_VOLUME);
  const top = (w: GainerWindow) => {
    const key = `change_${w}` as const;
    return liquid
      .filter((t) => t[key] !== null)
      .sort((a, b) => b[key]! - a[key]!)
      .slice(0, GAINERS_TOP);
  };
  return { '1h': top('1h'), '4h': top('4h'), '24h': top('24h') };
};

const readTab = (): Tab => {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === 'fav' || v === 'watch' || v === 'leader' || v === 'gainers') return v;
  } catch { /* 忽略 */ }
  return 'fav';
};

const leaderMeta = (it: LeaderBoardItem) => {
  const parts = [`#${it.rank}`, `量×${it.rvol.toFixed(1)}`];
  if (it.episode) parts.push(it.episode.phase_label);
  return (
    <>
      {parts.join(' · ')}
      {it.resonance && <b className={styles.resonance}> · 共振</b>}
    </>
  );
};

const fmtPct = (v: number | null) => (v === null ? '--' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`);
const fmtAmount = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : `${(v / 1e6).toFixed(0)}M`);

/** 涨幅榜附加信息：列太窄只放 24h 成交额，三个周期的涨幅放悬停提示 */
const gainerMeta = (t: LiveTicker) => {
  const full = GAINER_WINDOWS.map((x) => `${x} ${fmtPct(t[`change_${x}`])}`).join(' · ');
  return <span title={full}>额 {fmtAmount(t.quote_volume_24h ?? 0)}</span>;
};

/** 四个列表打开页面就加载（给预拉用）；但只订阅当前页签里币的实时价，其余页签不占 WS K 线流 */
const MarketSidebar: React.FC<MarketSidebarProps> = ({ favorites, current, onSelect, onRemoveFavorite, maxRows, onSymbolsChange }) => {
  const [tab, setTab] = useState<Tab>(readTab);
  const [watch, setWatch] = useState<WatchlistItem[] | null>(null);
  const [boards, setBoards] = useState<LeaderBoard[] | null>(null);
  const [gainers, setGainers] = useState<GainerBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeTab = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* 忽略 */ }
  };

  useEffect(() => {
    const table = new Map<string, LiveTicker>();
    let dirty = false;
    const remove = marketRelaySocket.addListener({
      onTickers: ({ full, rows, removed }) => {
        if (full) table.clear();
        rows.forEach((t) => table.set(t.symbol, t));
        removed.forEach((s) => table.delete(s));
        dirty = true;
      },
    });
    const unsubscribe = marketRelaySocket.subscribeTickers();
    const timer = window.setInterval(() => {
      if (!dirty) return;
      dirty = false;
      setGainers(rankGainers(table));
    }, GAINERS_RANK_MS);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
      remove();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const poll = (load: () => Promise<void>, ms: number) => {
      const run = () => load()
        .then(() => { if (!disposed) setError(null); })
        .catch((err: Error) => { if (!disposed) setError(err.message || '加载失败'); });
      run();
      return window.setInterval(run, ms);
    };
    const timers = [
      poll(() => trendFollowAPI.getWatchlist().then((rows) => { if (!disposed) setWatch(rows); }), WATCH_POLL_MS),
      poll(
        () => Promise.all([leaderAPI.getBoard('24h'), leaderAPI.getBoard('4h')]).then((b) => { if (!disposed) setBoards(b); }),
        LEADER_POLL_MS,
      ),
    ];
    return () => {
      disposed = true;
      timers.forEach((t) => window.clearInterval(t));
    };
  }, []);

  // 涨幅榜每秒重排，成员没变就不通知
  const onSymbolsChangeRef = useRef(onSymbolsChange);
  onSymbolsChangeRef.current = onSymbolsChange;
  const allSymbolsKey = [...new Set([
    ...favorites,
    ...(watch ?? []).slice(0, WATCH_PREFETCH_MAX).map((w) => w.symbol),
    ...(boards ?? []).flatMap((b) => b.items.map((it) => it.symbol)),
    ...(gainers ? GAINER_WINDOWS.flatMap((w) => gainers[w].map((t) => t.symbol)) : []),
  ])].join(',');
  useEffect(() => {
    onSymbolsChangeRef.current?.(allSymbolsKey ? allSymbolsKey.split(',') : []);
  }, [allSymbolsKey]);

  let groups: SymbolGroup[] = [];
  let emptyText: React.ReactNode = null;
  let note: string | null = null;
  if (tab === 'fav') {
    groups = [{ rows: favorites.map((symbol) => ({ symbol })) }];
    emptyText = '点工具栏的 ☆ 把当前币种加入自选';
  } else if (tab === 'watch') {
    // 后端已按评分从高到低排好
    const rows = watch ?? [];
    groups = [{
      rows: rows.slice(0, maxRows).map((w) => ({
        symbol: w.symbol,
        meta: `${w.timeframes.join('/')} · ${WATCH_STAGE_LABELS[w.stage] ?? w.stage} · ${w.score}分`,
      })),
    }];
    emptyText = watch === null ? '加载中…' : '观察列表为空';
    if (rows.length > maxRows) note = `共 ${rows.length} 个，按评分显示前 ${maxRows} 个`;
  } else if (tab === 'gainers') {
    groups = GAINER_WINDOWS.filter((w) => gainers?.[w].length).map((w) => ({
      title: `${w} 涨幅前 ${GAINERS_TOP}`,
      rows: gainers![w].map((t) => ({
        symbol: t.symbol,
        meta: gainerMeta(t),
        quote: { price: t.last_price, pct: t[`change_${w}`]! },
      })),
    }));
    emptyText = gainers === null ? '加载中…' : '暂无数据';
  } else {
    const titles: Record<string, string> = { '24h': '24h 主榜', '4h': '4h 刚启动' };
    groups = (boards ?? [])
      .filter((b) => b.items.length > 0)
      .map((b) => ({ title: titles[b.window] ?? b.window, rows: b.items.map((it) => ({ symbol: it.symbol, meta: leaderMeta(it) })) }));
    emptyText = boards === null ? '加载中…' : '当前榜单为空（门槛：成交额 ≥20M 且相对量 ≥3）';
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        <Segmented
          block
          size="small"
          value={tab}
          onChange={(v) => changeTab(v as Tab)}
          options={[
            { value: 'fav', label: '自选' },
            { value: 'watch', label: '观察' },
            { value: 'leader', label: '龙头' },
            { value: 'gainers', label: '涨幅' },
          ]}
        />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {note && <div className={styles.note}>{note}</div>}
      <div className={styles.list}>
        <SymbolWatchlist
          groups={groups}
          current={current}
          onSelect={onSelect}
          onRemove={tab === 'fav' ? onRemoveFavorite : undefined}
          emptyText={emptyText}
          pctLabel={tab === 'gainers' ? '涨幅' : undefined}
        />
      </div>
    </div>
  );
};

export default MarketSidebar;
