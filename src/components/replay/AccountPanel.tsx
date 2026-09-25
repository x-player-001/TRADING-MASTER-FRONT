import React, { useEffect, useState } from 'react';
import { InputNumber, Button, message } from 'antd';
import styles from './Replay.module.scss';
import type { ReplayView } from './useReplaySession';
import { fmtPrice, fmtQty, fmtUsd, fmtPct, fmtR, pnlSign } from './format';
import type { PickField, PickRequest } from './OrderPanel';

interface AccountPanelProps {
  view: ReplayView;
  disabled: boolean;
  picking: PickField | null;
  onPickStart: (field: PickField | null) => void;
  pickResult: PickRequest | null;
  /** 以下操作都在本地撮合，返回错误信息或 null */
  onSetProtection: (sl: number | null | undefined, tp: number | null | undefined) => string | null;
  onClosePosition: (qty?: number) => string | null;
  onCancelOrder: (clientId: string) => void;
}

const ORDER_TYPE_LABEL: Record<string, string> = { market: '市价', limit: '限价', stop: '条件' };

const AccountPanel: React.FC<AccountPanelProps> = ({
  view,
  disabled,
  picking,
  onPickStart,
  pickResult,
  onSetProtection,
  onClosePosition,
  onCancelOrder,
}) => {
  const { session, position, pending_orders: pending, equity, unrealized_pnl: upnl } = view;
  const [sl, setSl] = useState<number | null>(null);
  const [tp, setTp] = useState<number | null>(null);

  // 持仓的止损止盈变化时同步到输入框（换仓/被改/清除）
  useEffect(() => {
    setSl(position?.stop_loss ?? null);
    setTp(position?.take_profit ?? null);
  }, [position?.client_id, position?.stop_loss, position?.take_profit]);

  useEffect(() => {
    if (!pickResult) return;
    if (pickResult.field === 'pos_sl') setSl(pickResult.price);
    if (pickResult.field === 'pos_tp') setTp(pickResult.price);
  }, [pickResult]);

  const run = (fn: () => string | null) => {
    const error = fn();
    if (error) message.error(error);
  };

  const retPct = ((equity - session.initial_balance) / session.initial_balance) * 100;
  const slChanged = position && sl !== position.stop_loss;
  const tpChanged = position && tp !== position.take_profit;

  const pickBtn = (field: PickField) => (
    <button
      type="button"
      className={`${styles.pickBtn} ${picking === field ? styles.pickOn : ''}`}
      onClick={() => onPickStart(picking === field ? null : field)}
      title="在图上点击取价"
      disabled={disabled}
    >
      ⌖
    </button>
  );

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardTitle}>账户</div>
        <div className={styles.kvGrid}>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>权益</span>
            <span className={styles.kvValueLg}>{fmtUsd(equity)}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>收益率</span>
            <span className={`${styles.kvValueLg} ${styles[pnlSign(retPct)]}`}>{fmtPct(retPct)}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>余额</span>
            <span className={styles.kvValue}>{fmtUsd(session.balance)}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>浮动盈亏</span>
            <span className={`${styles.kvValue} ${styles[pnlSign(upnl)]}`}>{fmtUsd(upnl, true)}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>杠杆</span>
            <span className={styles.kvValue}>{session.leverage}x</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>初始资金</span>
            <span className={styles.kvValue}>{fmtUsd(session.initial_balance)}</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          持仓
          {position && (
            <span className={`${styles.dirTag} ${position.direction === 'long' ? styles.long : styles.short}`}>
              {position.direction === 'long' ? '多' : '空'}
            </span>
          )}
        </div>
        {!position ? (
          <div className={styles.dim}>空仓</div>
        ) : (
          <>
            <div className={styles.kvGrid}>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>数量</span>
                <span className={styles.kvValue}>{fmtQty(position.qty)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>均价</span>
                <span className={styles.kvValue}>{fmtPrice(position.avg_entry_price)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>浮盈</span>
                <span className={`${styles.kvValue} ${styles[pnlSign(position.unrealized_pnl)]}`}>
                  {fmtUsd(position.unrealized_pnl, true)}
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>浮动 R</span>
                <span className={`${styles.kvValue} ${styles[pnlSign(position.unrealized_r)]}`}>{fmtR(position.unrealized_r)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>计划风险</span>
                <span className={styles.kvValue}>{position.risk_amount ? `${fmtUsd(position.risk_amount)}U` : '未设止损'}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>手续费</span>
                <span className={styles.kvValue}>{fmtUsd(position.fee_total)}</span>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>止损</span>
              <InputNumber size="small" value={sl} onChange={setSl} min={0} style={{ flex: 1 }} disabled={disabled} />
              {pickBtn('pos_sl')}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>止盈</span>
              <InputNumber size="small" value={tp} onChange={setTp} min={0} style={{ flex: 1 }} disabled={disabled} />
              {pickBtn('pos_tp')}
            </div>
            {(slChanged || tpChanged) && (
              <Button
                size="small"
                block
                disabled={disabled}
                onClick={() => run(() => onSetProtection(slChanged ? sl : undefined, tpChanged ? tp : undefined))}
              >
                保存止损止盈{(sl === null && slChanged) || (tp === null && tpChanged) ? '（空值=清除）' : ''}
              </Button>
            )}

            <div className={styles.btnRow}>
              <Button size="small" disabled={disabled} onClick={() => run(() => onClosePosition(position.qty / 2))}>
                平一半
              </Button>
              <Button size="small" danger disabled={disabled} onClick={() => run(() => onClosePosition())}>
                市价全平
              </Button>
            </div>
          </>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>挂单 <span className={styles.dim}>{pending.length}</span></div>
        {pending.length === 0 ? (
          <div className={styles.dim}>无挂单</div>
        ) : (
          <div className={styles.orderList}>
            {pending.map((o) => (
              <div key={o.client_id} className={styles.orderRow}>
                <span className={o.side === 'buy' ? styles.pos : styles.neg}>
                  {ORDER_TYPE_LABEL[o.order_type]}{o.side === 'buy' ? '买' : '卖'}
                </span>
                <span>{fmtPrice(o.price)}</span>
                <span className={styles.dim}>× {fmtQty(o.qty)}</span>
                {o.reduce_only && <span className={styles.miniTag}>只减</span>}
                <button
                  type="button"
                  className={styles.linkBtn}
                  disabled={disabled}
                  onClick={() => onCancelOrder(o.client_id)}
                >
                  撤单
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default AccountPanel;
