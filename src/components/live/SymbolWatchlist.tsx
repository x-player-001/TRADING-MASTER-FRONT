import React, { useEffect, useRef, useState } from 'react';
import { marketRelaySocket } from '../../services/marketRelayAPI';
import styles from './SymbolWatchlist.module.scss';

export interface SymbolRow {
  symbol: string;
  /** 币种下方的一行附加信息（阶段、排名等） */
  meta?: React.ReactNode;
  /** 自带报价（如行情排行接口给的）：直接显示，不订阅实时流 */
  quote?: { price: number; pct: number };
}

export interface SymbolGroup {
  /** 分组标题，只有一组时可省略 */
  title?: string;
  rows: SymbolRow[];
}

interface SymbolWatchlistProps {
  groups: SymbolGroup[];
  current: string;
  onSelect: (symbol: string) => void;
  /** 不传则不显示移除按钮 */
  onRemove?: (symbol: string) => void;
  emptyText?: React.ReactNode;
  /** 涨跌列表头，默认「日涨跌」 */
  pctLabel?: string;
}

interface Quote {
  close: number;
  open: number;
}

/** 刷新列表的间隔：推送约 250ms 一次 × 多个币种，攒一批再渲染 */
const FLUSH_MS = 500;

/** 收盘价原样转字符串，保留交易所给的精度 */
const formatPrice = (v: number) => (v >= 1000 ? v.toFixed(2) : String(v));

/**
 * 币种列表：每个币种订阅一条 1d 流，拿最新价和当日涨跌
 * （日线开盘 = UTC 0 点 = 北京时间 8 点，和币安 App 的 24h 涨跌口径不同）
 */
const SymbolWatchlist: React.FC<SymbolWatchlistProps> = ({ groups, current, onSelect, onRemove, emptyText, pctLabel }) => {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const pendingRef = useRef<Record<string, Quote>>({});
  const subsRef = useRef(new Map<string, () => void>());

  useEffect(() => {
    const remove = marketRelaySocket.addListener({
      onKline: (k) => {
        if (k.interval !== '1d' || !subsRef.current.has(k.symbol)) return;
        pendingRef.current[k.symbol] = { close: k.close, open: k.open };
      },
    });
    const timer = window.setInterval(() => {
      const pending = pendingRef.current;
      if (Object.keys(pending).length === 0) return;
      pendingRef.current = {};
      setQuotes((prev) => ({ ...prev, ...pending }));
    }, FLUSH_MS);
    const subs = subsRef.current;
    return () => {
      remove();
      window.clearInterval(timer);
      subs.forEach((unsub) => unsub());
      subs.clear();
    };
  }, []);

  // 按差异增减订阅，增删一个币种不影响其他流；自带报价的行不订阅
  const rows = groups.flatMap((g) => g.rows);
  const symbolsKey = [...new Set(rows.filter((r) => !r.quote).map((r) => r.symbol))].join(',');
  useEffect(() => {
    const subs = subsRef.current;
    const wanted = new Set(symbolsKey ? symbolsKey.split(',') : []);
    subs.forEach((unsub, s) => {
      if (!wanted.has(s)) {
        unsub();
        subs.delete(s);
      }
    });
    wanted.forEach((s) => {
      if (!subs.has(s)) subs.set(s, marketRelaySocket.subscribe(s, '1d'));
    });
  }, [symbolsKey]);

  return (
    <div className={styles.wrap}>
      <div className={`${styles.row} ${styles.head}`}>
        <span>币种</span>
        <span className={styles.num}>最新价</span>
        {pctLabel ? (
          <span className={styles.num}>{pctLabel}</span>
        ) : (
          <span className={styles.num} title="相对今日开盘（北京时间 8:00）">日涨跌</span>
        )}
      </div>
      <div className={styles.list}>
        {rows.length === 0 && emptyText && <div className={styles.empty}>{emptyText}</div>}
        {groups.map((g, gi) => (
          <React.Fragment key={g.title ?? gi}>
            {g.title && <div className={styles.groupTitle}>{g.title}</div>}
            {g.rows.map(({ symbol: s, meta, quote }) => {
              const q = quotes[s];
              const price = quote ? quote.price : q ? q.close : null;
              const pct = quote ? quote.pct : q && q.open ? ((q.close - q.open) / q.open) * 100 : null;
              const tone = pct === null ? '' : pct >= 0 ? styles.up : styles.down;
              return (
                <div
                  key={s}
                  role="button"
                  tabIndex={0}
                  className={`${styles.row} ${styles.item} ${meta ? styles.tall : ''} ${s === current ? styles.active : ''}`}
                  onClick={() => onSelect(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelect(s);
                  }}
                >
                  <span className={styles.name}>
                    <span className={styles.symbol}>{s.replace(/USDT$/, '')}<i>{s.endsWith('USDT') ? '/USDT' : ''}</i></span>
                    {meta && <span className={styles.meta}>{meta}</span>}
                  </span>
                  <span className={`${styles.num} ${tone}`}>{price === null ? '—' : formatPrice(price)}</span>
                  <span className={`${styles.num} ${tone}`}>
                    {pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
                  </span>
                  {onRemove && (
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`移除 ${s}`}
                      title="移出自选"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(s);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default SymbolWatchlist;
