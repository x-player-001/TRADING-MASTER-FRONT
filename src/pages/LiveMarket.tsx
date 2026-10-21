import React, { useCallback, useEffect, useState } from 'react';
import { AutoComplete, Button, Checkbox, Segmented, Tooltip } from 'antd';
import PageHeader from '../components/ui/PageHeader';
import LiveChart from '../components/live/LiveChart';
import MarketSidebar from '../components/live/MarketSidebar';
import { setPrefetchTargets, stopPrefetch } from '../components/live/klineCache';
import { replayAPI } from '../services/replayAPI';
import {
  isRelayInterval,
  marketRelaySocket,
  RelayInterval,
  RelayKline,
  RelayStatus,
} from '../services/marketRelayAPI';
import styles from './LiveMarket.module.scss';

interface LiveMarketProps {
  isSidebarCollapsed?: boolean;
}

const SETTINGS_KEY = 'liveMarket.settings';

const WATCHLIST_KEY = 'liveMarket.watchlist';

interface Settings {
  symbol: string;
  interval: RelayInterval;
  showMa: boolean;
  showMacd: boolean;
  logScale: boolean;
}

const DEFAULT_SETTINGS: Settings = { symbol: 'BTCUSDT', interval: '15m', showMa: true, showMacd: true, logScale: true };

/** 页面提供的周期（行情中转支持的更多，这里只放常用的） */
const INTERVALS: RelayInterval[] = ['5m', '15m', '1h', '4h', '1d', '1w'];
const isPageInterval = (v: string): v is RelayInterval => isRelayInterval(v) && INTERVALS.includes(v);

/** 自选上限：WS 单连接最多 30 条流，留几条给图表 */
const MAX_WATCHLIST = 25;
/** 首次打开时按 30 日成交额取前几名做默认自选 */
const DEFAULT_WATCH_COUNT = 12;
const FALLBACK_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

/** null 表示从没存过（用默认列表），[] 表示用户清空了 */
const readWatchlist = (): string[] | null => {
  try {
    const v = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || 'null');
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, MAX_WATCHLIST) : null;
  } catch {
    return null;
  }
};

/** 优先取 URL（#live-market?symbol=ETHUSDT&interval=1h），其次本地记忆 */
const readSettings = (): Settings => {
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { /* 忽略 */ }
  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const symbol = (query.get('symbol') || saved.symbol || DEFAULT_SETTINGS.symbol).toUpperCase();
  const iv = query.get('interval') || saved.interval || '';
  return {
    symbol,
    interval: isPageInterval(iv) ? iv : DEFAULT_SETTINGS.interval,
    showMa: saved.showMa ?? DEFAULT_SETTINGS.showMa,
    showMacd: saved.showMacd ?? DEFAULT_SETTINGS.showMacd,
    logScale: saved.logScale ?? DEFAULT_SETTINGS.logScale,
  };
};

const useIsDark = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

const STATUS_TEXT: Record<RelayStatus, string> = { open: '实时', connecting: '连接中', closed: '未连接' };

const LiveMarket: React.FC<LiveMarketProps> = () => {
  const isDark = useIsDark();
  const [settings, setSettings] = useState<Settings>(readSettings);
  const { symbol, interval, showMa, showMacd, logScale } = settings;
  const [symbolInput, setSymbolInput] = useState(symbol);
  const [symbolOptions, setSymbolOptions] = useState<{ value: string }[]>([]);
  const [status, setStatus] = useState<RelayStatus>(marketRelaySocket.getStatus());
  const [watchlist, setWatchlist] = useState<string[] | null>(readWatchlist);
  const [sidebarSymbols, setSidebarSymbols] = useState<string[]>([]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  }, []);

  useEffect(() => marketRelaySocket.addListener({ onStatus: setStatus }), []);

  // 后台预拉侧栏全部币的 K 线（已缓存的跳过），点开不用等
  useEffect(() => {
    setPrefetchTargets(sidebarSymbols, { symbol, interval });
  }, [sidebarSymbols, symbol, interval]);
  useEffect(() => stopPrefetch, []);

  const saveWatchlist = useCallback((updater: (prev: string[]) => string[]) => {
    setWatchlist((prev) => {
      const next = updater(prev ?? []).slice(0, MAX_WATCHLIST);
      try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  }, []);

  // 品种下拉：复用K线回放的推荐列表（只取币安合约）；没存过自选时取成交额前几名
  useEffect(() => {
    replayAPI.getSymbols()
      .then((res) => {
        const ranked = [...res.crypto].sort((a, b) => b.avg_quote_volume_30d - a.avg_quote_volume_30d);
        setSymbolOptions(ranked.map((c) => ({ value: c.symbol })));
        setWatchlist((prev) => prev ?? ranked.slice(0, DEFAULT_WATCH_COUNT).map((c) => c.symbol));
      })
      .catch(() => {
        setSymbolOptions(FALLBACK_SYMBOLS.map((value) => ({ value })));
        setWatchlist((prev) => prev ?? FALLBACK_SYMBOLS);
      });
  }, []);

  const watched = watchlist ?? [];
  const isWatched = watched.includes(symbol);
  const toggleWatch = () =>
    saveWatchlist((prev) => (prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]));

  // 浏览器标签显示最新价
  const onLastBar = useCallback((k: RelayKline | null) => {
    if (k) document.title = `${k.close} ${k.symbol} · Trading Master`;
  }, []);
  useEffect(() => {
    const original = document.title;
    return () => { document.title = original; };
  }, []);

  const commitSymbol = (value: string) => {
    const s = value.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,30}$/.test(s)) {
      setSymbolInput(symbol);
      return;
    }
    setSymbolInput(s);
    if (s !== symbol) update({ symbol: s });
  };

  const filtered = symbolOptions.filter((o) => o.value.includes(symbolInput.trim().toUpperCase()));

  return (
    <div className={styles.page}>
      <PageHeader title="实时看盘" subtitle="币安 U 本位合约实时 K 线（服务器中转）" icon="📺">
        <span className={`${styles.status} ${styles[status]}`}>
          <i className={styles.dot} />
          {STATUS_TEXT[status]}
        </span>
      </PageHeader>

      <div className={styles.toolbar}>
        <AutoComplete
          className={styles.symbolInput}
          value={symbolInput}
          options={filtered.slice(0, 50)}
          onChange={(v) => setSymbolInput(String(v).toUpperCase())}
          onSelect={(v) => commitSymbol(String(v))}
          onBlur={() => commitSymbol(symbolInput)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitSymbol((e.target as HTMLInputElement).value);
          }}
          placeholder="币种，如 BTCUSDT"
        />
        <div className={styles.intervals}>
          <Segmented
            size="small"
            value={interval}
            options={INTERVALS.map((v) => ({ value: v, label: v }))}
            onChange={(v) => update({ interval: v as RelayInterval })}
          />
        </div>
        <Tooltip title={isWatched ? '移出自选' : watched.length >= MAX_WATCHLIST ? `自选最多 ${MAX_WATCHLIST} 个` : '加入自选'}>
          <Button
            size="small"
            className={isWatched ? styles.starred : undefined}
            disabled={!isWatched && watched.length >= MAX_WATCHLIST}
            onClick={toggleWatch}
          >
            {isWatched ? '★' : '☆'} 自选
          </Button>
        </Tooltip>
        <span className={styles.indicators}>
          <Checkbox checked={showMa} onChange={(e) => update({ showMa: e.target.checked })}>均线</Checkbox>
          <Checkbox checked={showMacd} onChange={(e) => update({ showMacd: e.target.checked })}>MACD</Checkbox>
          <Tooltip title="价格轴按百分比等距，适合看大周期、涨幅很大的币">
            <Checkbox checked={logScale} onChange={(e) => update({ logScale: e.target.checked })}>对数</Checkbox>
          </Tooltip>
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.chartCard}>
          <LiveChart
            symbol={symbol}
            interval={interval}
            isDark={isDark}
            onLastBar={onLastBar}
            showMa={showMa}
            showMacd={showMacd}
            logScale={logScale}
          />
        </div>
        <div className={styles.watchCard}>
          <MarketSidebar
            favorites={watched}
            current={symbol}
            maxRows={MAX_WATCHLIST}
            onSymbolsChange={setSidebarSymbols}
            onSelect={(s) => {
              setSymbolInput(s);
              if (s !== symbol) update({ symbol: s });
            }}
            onRemoveFavorite={(s) => saveWatchlist((prev) => prev.filter((x) => x !== s))}
          />
        </div>
      </div>
    </div>
  );
};

export default LiveMarket;
