import React, { useCallback, useEffect, useState } from 'react';
import { AutoComplete, Segmented } from 'antd';
import PageHeader from '../components/ui/PageHeader';
import LiveChart from '../components/live/LiveChart';
import { replayAPI } from '../services/replayAPI';
import {
  isRelayInterval,
  marketRelaySocket,
  RELAY_INTERVALS,
  RelayInterval,
  RelayKline,
  RelayStatus,
} from '../services/marketRelayAPI';
import styles from './LiveMarket.module.scss';

interface LiveMarketProps {
  isSidebarCollapsed?: boolean;
}

const SETTINGS_KEY = 'liveMarket.settings';

interface Settings {
  symbol: string;
  interval: RelayInterval;
}

const DEFAULT_SETTINGS: Settings = { symbol: 'BTCUSDT', interval: '15m' };

/** 优先取 URL（#live-market?symbol=ETHUSDT&interval=1h），其次本地记忆 */
const readSettings = (): Settings => {
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { /* 忽略 */ }
  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const symbol = (query.get('symbol') || saved.symbol || DEFAULT_SETTINGS.symbol).toUpperCase();
  const iv = query.get('interval') || saved.interval || '';
  return { symbol, interval: isRelayInterval(iv) ? iv : DEFAULT_SETTINGS.interval };
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
  const { symbol, interval } = settings;
  const [symbolInput, setSymbolInput] = useState(symbol);
  const [symbolOptions, setSymbolOptions] = useState<{ value: string }[]>([]);
  const [status, setStatus] = useState<RelayStatus>(marketRelaySocket.getStatus());

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  }, []);

  useEffect(() => marketRelaySocket.addListener({ onStatus: setStatus }), []);

  // 品种下拉：复用K线回放的推荐列表（只取币安合约）
  useEffect(() => {
    replayAPI.getSymbols()
      .then((res) => setSymbolOptions(res.crypto.map((c) => ({ value: c.symbol }))))
      .catch(() => setSymbolOptions(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'].map((value) => ({ value }))));
  }, []);

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
            options={RELAY_INTERVALS.map((v) => ({ value: v, label: v }))}
            onChange={(v) => update({ interval: v as RelayInterval })}
          />
        </div>
      </div>

      <div className={styles.chartCard}>
        <LiveChart symbol={symbol} interval={interval} isDark={isDark} onLastBar={onLastBar} />
      </div>
    </div>
  );
};

export default LiveMarket;
