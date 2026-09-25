import React, { useCallback, useEffect, useState } from 'react';
import { Button, Segmented, Select, Table, Tag, Popconfirm, Modal, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import styles from './KlineReplay.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../components/ui';
import ReplayChart from '../components/replay/ReplayChart';
import OrderPanel, { PickField, PickRequest } from '../components/replay/OrderPanel';
import AccountPanel from '../components/replay/AccountPanel';
import ReplayRecords from '../components/replay/ReplayRecords';
import CreateSessionModal from '../components/replay/CreateSessionModal';
import { useReplaySession } from '../components/replay/useReplaySession';
import { fmtPrice, fmtTime, fmtUsd, fmtPct, fmtR, pnlSign } from '../components/replay/format';
import rstyles from '../components/replay/Replay.module.scss';
import { saveDrawings } from '../components/replay/drawings';
import {
  replayAPI,
  ReplayEvent,
  ReplayInterval,
  ReplaySessionRow,
  REPLAY_INTERVALS,
  EXIT_REASON_LABELS,
} from '../services/replayAPI';

interface KlineReplayProps {
  isSidebarCollapsed?: boolean;
}

const SPEEDS = [
  { label: '1x', value: 1000 },
  { label: '2x', value: 500 },
  { label: '5x', value: 200 },
  { label: '10x', value: 100 },
];
const LAST_SESSION_KEY = 'replay.lastSessionId';
const GAP_NOTIFY_BARS = 12; // 缺口不足 1 小时（零星缺几根）不提示

const sideText = (side: string, action: string) => {
  const isBuy = side === 'buy';
  if (action === 'open') return isBuy ? '开多' : '开空';
  if (action === 'add') return isBuy ? '加多' : '加空';
  if (action === 'reduce') return isBuy ? '减空' : '减多';
  if (action === 'close') return isBuy ? '平空' : '平多';
  return isBuy ? '买入' : '卖出';
};

const gapText = (missingBars: number) => {
  const hours = (missingBars * 5) / 60;
  return hours >= 24 ? `${(hours / 24).toFixed(1)} 天` : `${hours.toFixed(1)} 小时`;
};

// 撮合事件 → 提示
const notifyEvents = (events: ReplayEvent[]) => {
  for (const e of events) {
    switch (e.type) {
      case 'fill':
        message.info(`成交：${sideText(e.fill.side, e.fill.action)} ${Number(e.fill.qty.toFixed(6))} @ ${fmtPrice(e.fill.price)}`);
        break;
      case 'position_closed': {
        const p = e.position;
        const txt = `平仓（${EXIT_REASON_LABELS[p.exit_reason ?? ''] ?? p.exit_reason ?? ''}）净盈亏 ${fmtUsd(p.net_pnl, true)}U${p.r_multiple !== null ? ` · ${fmtR(p.r_multiple)}` : ''}`;
        if (p.net_pnl >= 0) message.success(txt, 4); else message.warning(txt, 4);
        break;
      }
      case 'order_rejected':
        message.error(`委托被拒：${e.reason ?? e.order.reject_reason ?? ''}`, 4);
        break;
      case 'order_cancelled':
        message.info(`已撤单：${e.reason ?? ''}`);
        break;
      case 'gap':
        if (e.missing_bars >= GAP_NOTIFY_BARS) {
          message.warning(`数据缺口：${fmtTime(e.from_time)} → ${fmtTime(e.to_time)}，跳过了 ${gapText(e.missing_bars)}`, 4);
        }
        break;
      default:
        break;
    }
  }
};

// 跟随全局明暗主题（App 在 <html> 上切换 .dark）
const useIsDark = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

const KlineReplay: React.FC<KlineReplayProps> = () => {
  const isDark = useIsDark();
  const rs = useReplaySession({ onEvents: notifyEvents });
  const { view, bars, fills, positions, endOfData } = rs;

  // ── 会话列表 ──
  const [sessions, setSessions] = useState<ReplaySessionRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'finished'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  // ── 当前会话的界面状态 ──
  const [interval, setInterval_] = useState<ReplayInterval>('5m');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [picking, setPicking] = useState<PickField | null>(null);
  const [pickResult, setPickResult] = useState<PickRequest | null>(null);

  const finished = view?.session.status === 'finished';

  const loadSessions = useCallback(async () => {
    setListLoading(true);
    try {
      const list = await replayAPI.listSessions({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      });
      setSessions(list);
      setListError(null);
    } catch (err) {
      setListError((err as Error).message || '加载会话失败');
    } finally {
      setListLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const { open: openRuntime, close: closeRuntime, step, flush } = rs;

  const openSession = useCallback(async (arg: Parameters<typeof openRuntime>[0]) => {
    setPlaying(false);
    setPicking(null);
    try {
      const session = await openRuntime(arg);
      try { localStorage.setItem(LAST_SESSION_KEY, String(session.id)); } catch { /* 忽略 */ }
    } catch (err) {
      message.error((err as Error).message || '打开会话失败');
      // 记住的会话可能已被删除，清掉避免每次进页面都报错
      try { localStorage.removeItem(LAST_SESSION_KEY); } catch { /* 忽略 */ }
    }
  }, [openRuntime]);

  const backToList = async () => {
    setPlaying(false);
    setPicking(null);
    try { localStorage.removeItem(LAST_SESSION_KEY); } catch { /* 忽略 */ }
    await closeRuntime(); // 先把没同步的进度发出去
    loadSessions();
  };

  // 上次停在某个会话里，回到页面时直接恢复
  useEffect(() => {
    let last: string | null = null;
    try { last = localStorage.getItem(LAST_SESSION_KEY); } catch { /* 忽略 */ }
    if (last && Number(last) > 0) openSession(Number(last));
  }, [openSession]);

  // 自动播放：本地逐根推进，有成交或到末尾就停；暂停时同步一次进度
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const res = await step(1, 'fill');
      if (cancelled) return;
      if (!res || res.endOfData) { setPlaying(false); return; }
      if (res.events.some((e) => e.type === 'fill')) {
        setPlaying(false);
        message.info('有成交，自动播放已暂停');
        return;
      }
      timer = setTimeout(tick, speed);
    };
    timer = setTimeout(tick, speed);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      void flush();
    };
  }, [playing, speed, step, flush]);

  // 键盘：→ / 空格 下一根，Shift+→ 前进 12 根
  useEffect(() => {
    if (!view || finished) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.key === 'ArrowRight' || e.key === ' ') && !endOfData && !playing) {
        // 空格默认会触发当前聚焦的按钮（比如刚点过的「下一根」），一并拦掉
        e.preventDefault();
        void step(e.key === 'ArrowRight' && e.shiftKey ? 12 : 1);
      } else if (e.key === 'Escape') {
        setPicking(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, finished, endOfData, playing, step]);

  const handlePriceClick = useCallback((price: number) => {
    if (!picking) return;
    setPickResult({ field: picking, price: Number(fmtPrice(price)), nonce: Date.now() });
    setPicking(null);
  }, [picking]);

  const finishSession = () => {
    Modal.confirm({
      title: '结束本次回放？',
      content: '会按当前收盘价平掉持仓、撤销全部挂单，之后会话只读（仍可给仓位加标签和笔记）。',
      okText: '结束',
      okButtonProps: { danger: true },
      onOk: async () => {
        setPlaying(false);
        const synced = await rs.finish();
        if (!synced) message.warning('已在本地结束，但同步失败，稍后会自动重试');
        else message.success('会话已结束，可在「统计」查看复盘');
      },
    });
  };

  const deleteSession = async (id: number) => {
    try {
      await replayAPI.deleteSession(id);
      saveDrawings(String(id), []); // 顺带清掉本地存的画线
      message.success('已删除');
      loadSessions();
    } catch (err) {
      message.error((err as Error).message || '删除失败');
    }
  };

  // ── 会话列表 ──
  const columns: ColumnsType<ReplaySessionRow> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (name, s) => (
        <a onClick={() => openSession(s.id)} className={styles.sessionName}>
          {name || `回放 #${s.id}`}
        </a>
      ),
    },
    { title: '币种', dataIndex: 'symbol', width: 110 },
    { title: '起点', dataIndex: 'start_time', width: 150, render: (t) => fmtTime(t) },
    { title: '回放到', dataIndex: 'cursor_time', width: 150, render: (t) => fmtTime(t) },
    { title: '步数', dataIndex: 'bars_stepped', width: 80 },
    {
      title: '余额 / 收益',
      width: 170,
      render: (_, s) => {
        const ret = ((s.balance - s.initial_balance) / s.initial_balance) * 100;
        return (
          <span>
            {fmtUsd(s.balance)} <span className={rstyles[pnlSign(ret)]}>{fmtPct(ret)}</span>
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (st) => (st === 'active' ? <Tag color="processing">进行中</Tag> : <Tag>已结束</Tag>),
    },
    {
      title: '操作',
      width: 130,
      render: (_, s) => (
        <span className={styles.rowActions}>
          <Button size="small" type="link" onClick={() => openSession(s.id)}>
            {s.status === 'active' ? '继续' : '查看'}
          </Button>
          <Popconfirm title="删除会话及全部交易记录？" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => deleteSession(s.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  const session = view?.session;
  const stepDisabled = finished || endOfData || playing;

  const syncBadge =
    rs.syncStatus === 'syncing' ? <span className={styles.dim}>同步中…</span>
      : rs.syncStatus === 'error' ? (
        <Tooltip title={`${rs.syncError ?? ''}，点击重试`}>
          <a className={styles.syncError} onClick={() => void flush()}>同步失败</a>
        </Tooltip>
      ) : <span className={styles.dim}>已同步</span>;

  return (
    <div className={styles.page}>
      <TopProgressBar isVisible={rs.loading || rs.stepping || listLoading} progress={rs.loading ? 50 : 85} absolute />

      <PageHeader title="K线回放" subtitle="历史K线逐根回放，模拟下单，练盘感也练执行" icon="⏯️">
        {view ? (
          <Button onClick={backToList}>← 会话列表</Button>
        ) : (
          <>
            <CoolRefreshButton onClick={loadSessions} loading={listLoading} size="small" iconOnly />
            <Button type="primary" onClick={() => setCreateOpen(true)}>＋ 新建回放</Button>
          </>
        )}
      </PageHeader>

      {!view || !session ? (
        <DataSection
          title="回放会话"
          subtitle={`共 ${sessions.length} 个`}
          loading={listLoading && sessions.length === 0}
          error={listError}
          empty={!listLoading && !listError && sessions.length === 0}
          emptyText="还没有回放会话，点右上角「新建回放」开始"
          headerActions={
            <Segmented
              size="small"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { label: '全部', value: 'all' },
                { label: '进行中', value: 'active' },
                { label: '已结束', value: 'finished' },
              ]}
            />
          }
        >
          <Table rowKey="id" size="small" columns={columns} dataSource={sessions} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 900 }} />
        </DataSection>
      ) : (
        <>
          {/* 工具栏：周期 / 游标 / 步进 / 播放 */}
          <div className={styles.toolbar}>
            <span className={styles.symbol}>{session.symbol}</span>
            <span className={styles.sessionTitle}>{session.name || `回放 #${session.id}`}</span>
            {finished && <Tag>已结束 · 只读</Tag>}

            <Segmented
              size="small"
              value={interval}
              onChange={(v) => setInterval_(v as ReplayInterval)}
              options={REPLAY_INTERVALS}
            />

            <Tooltip title="游标K线（北京时间）">
              <span className={styles.cursor}>
                {fmtTime(view.current_bar.open_time)}
                <span className={styles.cursorPrice}>{fmtPrice(view.current_bar.close)}</span>
              </span>
            </Tooltip>

            <div className={styles.stepGroup}>
              <Tooltip title="下一根 5m（→ 或 空格）">
                <Button size="small" type="primary" onClick={() => void step(1)} disabled={stepDisabled}>
                  下一根 ▶
                </Button>
              </Tooltip>
              <Tooltip title="前进 1 小时（Shift+→）">
                <Button size="small" onClick={() => void step(12)} disabled={stepDisabled}>+1h</Button>
              </Tooltip>
              <Button size="small" onClick={() => void step(48)} disabled={stepDisabled}>+4h</Button>
              <Tooltip title="快进，遇到成交就停（最多 2000 根）">
                <Button size="small" onClick={() => void step(2000, 'fill')} disabled={stepDisabled || rs.stepping}>
                  ⏩ 到成交
                </Button>
              </Tooltip>
              <Tooltip title="快进，持仓平掉就停（最多 2000 根）">
                <Button size="small" onClick={() => void step(2000, 'position_closed')} disabled={stepDisabled || rs.stepping || !view.position}>
                  ⏩ 到平仓
                </Button>
              </Tooltip>
            </div>

            <div className={styles.stepGroup}>
              <Tooltip title="自动播放，有成交自动暂停">
                <Button size="small" onClick={() => setPlaying((p) => !p)} disabled={finished || endOfData}>
                  {playing ? '⏸ 暂停' : '▶ 播放'}
                </Button>
              </Tooltip>
              <Select size="small" value={speed} onChange={setSpeed} options={SPEEDS} style={{ width: 70 }} />
            </div>

            <span className={styles.toolbarRight}>
              {endOfData && !finished && <Tag color="warning">已到数据末尾</Tag>}
              <span className={styles.dim}>已走 {session.bars_stepped} 根</span>
              {syncBadge}
              {!finished && (
                <Button size="small" danger onClick={finishSession}>结束会话</Button>
              )}
            </span>
          </div>

          <div className={styles.workspace}>
            <div className={styles.chartCard}>
              {picking && (
                <div className={styles.pickHint}>
                  在图上点击选择{picking === 'price' ? '委托价' : picking.endsWith('sl') || picking === 'stop_loss' ? '止损价' : '止盈价'}（Esc 取消）
                </div>
              )}
              <ReplayChart
                bars={bars[interval]}
                interval={interval}
                fills={fills}
                position={view.position}
                pendingOrders={view.pending_orders}
                isDark={isDark}
                onPriceClick={handlePriceClick}
                picking={!!picking}
                drawingKey={String(session.id)}
                onProtectionDrag={
                  finished
                    ? undefined
                    : (kind, price) => rs.setProtection(kind === 'sl' ? price : undefined, kind === 'tp' ? price : undefined)
                }
              />
            </div>

            <div className={styles.side}>
              <AccountPanel
                view={view}
                disabled={finished}
                picking={picking}
                onPickStart={setPicking}
                pickResult={pickResult}
                onSetProtection={rs.setProtection}
                onClosePosition={rs.closePosition}
                onCancelOrder={rs.cancelOrder}
              />
              <OrderPanel
                view={view}
                disabled={finished || endOfData}
                picking={picking}
                onPickStart={setPicking}
                pickResult={pickResult}
                onSubmit={rs.submitOrder}
              />
            </div>
          </div>

          <ReplayRecords
            sessionId={session.id}
            positions={positions}
            fills={fills}
            statsKey={rs.statsKey}
            onSaveReview={rs.updateJournal}
          />
        </>
      )}

      <CreateSessionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(state) => {
          setCreateOpen(false);
          openSession(state);
        }}
      />
    </div>
  );
};

export default KlineReplay;
