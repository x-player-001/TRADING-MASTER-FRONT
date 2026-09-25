import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip, Segmented } from 'antd';
import styles from './AuctionBoard.module.scss';
import {
  auctionAPI,
  AuctionMarketDay,
  AuctionConceptList,
  AuctionConcept,
  AuctionConceptOrder,
} from '../../services/auctionAPI';

interface AuctionBoardProps {
  refreshKey: number;
  onOpenKline?: (stock: { code: string; name?: string }) => void;
}

const CONCEPT_LIMIT = 10;

const ORDER_OPTIONS: { label: string; value: AuctionConceptOrder; hint: string }[] = [
  { label: '抢筹强度', value: 'up_strength', hint: '只计竞价红盘成分的强度' },
  { label: '相对强度', value: 'strength', hint: '不分买卖方向的竞价额强度' },
  { label: '竞价额', value: 'amount', hint: '概念成分股竞价成交额合计' },
  { label: '抢筹只数', value: 'n_hot', hint: '概念内抢筹的成分股数量' },
];

const fmtYi = (v: number): string => `${(v / 1e8).toFixed(v >= 1e10 ? 1 : 2)}亿`;

const fmtPct = (v: number | null, digits = 2): string => {
  if (v === null) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
};

const fmtX = (v: number | null): string => (v === null ? '—' : `×${v.toFixed(2)}`);

const retClass = (v: number | null): string => {
  if (v === null) return '';
  return v > 0 ? styles.up : v < 0 ? styles.down : '';
};

// 竞价成交额迷你走势（history 是倒序，画之前翻成正序）
const AmountSpark: React.FC<{ history: AuctionMarketDay[] }> = ({ history }) => {
  const pts = [...history].reverse().map((d) => d.total_amount);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const W = 72;
  const H = 20;
  const d = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * W},${H - 1 - ((v - min) / span) * (H - 2)}`)
    .join(' ');
  return (
    <Tooltip title={`近 ${pts.length} 个交易日竞价成交额`}>
      <svg width={W} height={H} className={styles.spark}>
        <path d={d} fill="none" stroke="#f59e0b" strokeWidth="1.4" />
      </svg>
    </Tooltip>
  );
};

// ── 全市场竞价汇总：和标题放同一行 ──
const MarketInline: React.FC<{ history: AuctionMarketDay[] }> = ({ history }) => {
  const day = history[0];
  const flat = Math.max(day.n_traded - day.n_up - day.n_down, 0);
  const breadthTotal = day.n_up + flat + day.n_down || 1;
  return (
    <>
      <span className={styles.amount}>{fmtYi(day.total_amount)}</span>
      <Tooltip title="较上一个有数据交易日">
        <span className={`${styles.chg} ${retClass(day.chg_pct)}`}>{fmtPct(day.chg_pct)}</span>
      </Tooltip>
      <AmountSpark history={history} />
      <span className={styles.exch}>
        沪 {fmtYi(day.sh_amount)} · 深 {fmtYi(day.sz_amount)} · 北 {fmtYi(day.bj_amount)}
      </span>
      <Tooltip title={`竞价有成交 ${day.n_traded} / 共 ${day.n_codes} 只`}>
        <span className={styles.breadth}>
          <span className={styles.up}>涨 {day.n_up}</span>
          <span className={styles.breadthBar}>
            <span className={styles.barUp} style={{ width: `${(day.n_up / breadthTotal) * 100}%` }} />
            <span className={styles.barFlat} style={{ width: `${(flat / breadthTotal) * 100}%` }} />
            <span className={styles.barDown} style={{ width: `${(day.n_down / breadthTotal) * 100}%` }} />
          </span>
          <span className={styles.down}>跌 {day.n_down}</span>
          <span className={styles.dim}>平 {flat}</span>
        </span>
      </Tooltip>
      <span className={styles.limit}>
        涨停 <b className={styles.up}>{day.n_limit_up}</b> · 跌停 <b className={styles.down}>{day.n_limit_down}</b>
      </span>
    </>
  );
};

// ── 单个概念卡片 ──
const ConceptCard: React.FC<{
  c: AuctionConcept;
  rank: number;
  base: AuctionConceptList;
  onOpenKline?: AuctionBoardProps['onOpenKline'];
}> = ({ c, rank, base, onOpenKline }) => {
  // 强于全市场基准才高亮
  const upHot = base.market_up_strength !== null && c.up_strength > base.market_up_strength;
  const relHot = base.market_strength !== null && c.strength > base.market_strength;
  return (
    <div className={styles.card}>
      <Tooltip
        title={
          <div className={styles.tip}>
            <div>{c.concept} · 成分股 {c.n_stocks} 只</div>
            <div>竞价额 {fmtYi(c.auction_amount)}，其中红盘 {fmtYi(c.up_amount)}</div>
            <div>抢筹强度 {fmtX(c.up_strength)}（全市场 {fmtX(base.market_up_strength)}）</div>
            <div>相对强度 {fmtX(c.strength)}（全市场 {fmtX(base.market_strength)}）</div>
            <div>成分股强度中位数 {fmtX(c.median_strength)}</div>
            <div>最大单票占比 {c.top_share.toFixed(1)}%</div>
          </div>
        }
      >
        <div className={styles.cardTop}>
          <span className={styles.rank}>{rank}</span>
          <span className={styles.name}>{c.concept}</span>
          {c.n_hot > 0 && <span className={styles.hotTag}>抢筹 {c.n_hot}</span>}
        </div>
      </Tooltip>

      <div className={styles.cardMetrics}>
        <span className={`${styles.metric} ${upHot ? styles.metricHot : ''}`}>
          <span className={styles.metricLabel}>抢筹</span>
          {fmtX(c.up_strength)}
        </span>
        <span className={`${styles.metric} ${relHot ? styles.metricHot : ''}`}>
          <span className={styles.metricLabel}>相对</span>
          {fmtX(c.strength)}
        </span>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>竞价额</span>
          {fmtYi(c.auction_amount)}
        </span>
      </div>

      <div className={styles.cardFoot}>
        <span>红盘 {c.up_ratio.toFixed(0)}%</span>
        <span className={retClass(c.avg_pct)}>均 {fmtPct(c.avg_pct)}</span>
      </div>

      {c.top.length > 0 && (
        <div className={styles.topStocks}>
          {c.top.slice(0, 3).map((s) => (
            <Tooltip key={s.code} title={`${s.code} · 竞价额 ${fmtYi(s.auction_amount)}，占概念 ${s.share.toFixed(1)}% · 强度 ${fmtX(s.strength)}`}>
              <span
                className={`${styles.stock} ${onOpenKline ? styles.stockLink : ''}`}
                onClick={() => onOpenKline?.({ code: s.code, name: s.name ?? undefined })}
              >
                {s.name ?? s.code}
                <span className={retClass(s.auction_pct)}>{fmtPct(s.auction_pct, 1)}</span>
              </span>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
};

const AuctionBoard: React.FC<AuctionBoardProps> = ({ refreshKey, onOpenKline }) => {
  const [history, setHistory] = useState<AuctionMarketDay[] | null>(null);
  const [marketFailed, setMarketFailed] = useState(false);
  const [concepts, setConcepts] = useState<AuctionConceptList | null>(null);
  const [conceptsFailed, setConceptsFailed] = useState(false);
  const [order, setOrder] = useState<AuctionConceptOrder>('up_strength');
  const [collapsed, setCollapsed] = useState(true);  // 概念卡片默认收起，只留标题行的全市场汇总

  const loadMarket = useCallback(async () => {
    try {
      setHistory(await auctionAPI.getMarket({ days: 20 }));
      setMarketFailed(false);
    } catch (err) {
      console.error('加载集合竞价汇总失败:', err);
      setMarketFailed(true);
    }
  }, []);

  // 概念是独立接口，挂了不影响全市场汇总；收起时不请求，展开后再拉
  const loadConcepts = useCallback(async () => {
    try {
      setConcepts(await auctionAPI.getConcepts({ order_by: order, limit: CONCEPT_LIMIT }));
      setConceptsFailed(false);
    } catch (err) {
      console.error('加载概念竞价资金失败:', err);
      setConceptsFailed(true);
    }
  }, [order]);

  useEffect(() => { loadMarket(); }, [loadMarket, refreshKey]);
  useEffect(() => {
    if (!collapsed) loadConcepts();
  }, [loadConcepts, refreshKey, collapsed]);

  if (!history && !marketFailed) return null;

  const day = history?.[0];

  return (
    <div className={styles.board}>
      <div className={styles.head}>
        <span className={styles.title}>集合竞价</span>
        {day && <span className={styles.meta}>{day.trade_date}</span>}
        {day && !day.complete && (
          <Tooltip title="当日数据尚未采集完整，数字还会变">
            <span className={styles.incomplete}>采集中 {day.n_fetched}/{day.n_codes}</span>
          </Tooltip>
        )}
        {history && history.length > 0 ? (
          <MarketInline history={history} />
        ) : (
          <span className={styles.dim}>{marketFailed ? '全市场汇总暂不可用' : '暂无全市场汇总'}</span>
        )}
        <button className={styles.toggle} onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? '概念 ▾' : '收起 ▴'}
        </button>
      </div>

      {!collapsed && (
        <div className={styles.concepts}>
          <div className={styles.conceptHead}>
            <span className={styles.subTitle}>概念竞价资金</span>
            {concepts && (
              <Tooltip title={`强度是倍数，概念强于全市场基准时高亮${concepts.prev_date ? `；对比日 ${concepts.prev_date}` : ''}`}>
                <span className={styles.baseline}>
                  全市场基准：抢筹 {fmtX(concepts.market_up_strength)} · 相对 {fmtX(concepts.market_strength)}
                </span>
              </Tooltip>
            )}
            <span className={styles.orderSwitch}>
              <Segmented
                size="small"
                value={order}
                onChange={(v) => setOrder(v as AuctionConceptOrder)}
                options={ORDER_OPTIONS.map((o) => ({
                  value: o.value,
                  label: <Tooltip title={o.hint}>{o.label}</Tooltip>,
                }))}
              />
            </span>
          </div>

          {conceptsFailed ? (
            <span className={styles.dim}>概念竞价资金暂不可用</span>
          ) : !concepts ? (
            <span className={styles.dim}>加载中…</span>
          ) : concepts.items.length === 0 ? (
            <span className={styles.dim}>{concepts.note ?? '暂无概念竞价数据'}</span>
          ) : (
            <>
              <div className={styles.conceptGrid}>
                {concepts.items.map((c, i) => (
                  <ConceptCard key={c.thscode ?? c.concept} c={c} rank={i + 1} base={concepts} onOpenKline={onOpenKline} />
                ))}
              </div>
              <div className={styles.conceptFoot}>
                共 {concepts.total} 个概念，显示前 {concepts.items.length}
                <span className={styles.dim}>（已过滤成分股少于 10 只、单票占比超 40% 的概念及宽基标签）</span>
                {concepts.note && <span className={styles.note}>{concepts.note}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AuctionBoard;
