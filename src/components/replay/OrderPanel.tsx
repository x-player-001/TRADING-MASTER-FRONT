import React, { useEffect, useMemo, useState } from 'react';
import { InputNumber, Segmented, Select, Checkbox, Input, Button, message } from 'antd';
import styles from './Replay.module.scss';
import type { CmeContract, ReplaySide as OrderSide, ReplayOrderType as OrderType } from '../../services/replayAPI';
import type { ReplayOrderInput } from '../../services/kline_replay/replay_account';
import type { ReplayView } from './useReplaySession';
import { fmtSize, fmtUsd, quoteUnit, roundToTick } from './format';

export type PickField = 'price' | 'stop_loss' | 'take_profit' | 'pos_sl' | 'pos_tp';

export interface PickRequest {
  field: PickField;
  price: number;
  nonce: number;
}

/** qty：币安按币数；lots：CME 期货按手 */
type SizeMode = 'risk' | 'notional' | 'qty' | 'lots';

interface OrderPanelProps {
  view: ReplayView;
  disabled: boolean;
  picking: PickField | null;
  onPickStart: (field: PickField | null) => void;
  pickResult: PickRequest | null;
  /** 本地撮合下单；返回的 order.status='rejected' 表示被拒（原因走事件提示） */
  onSubmit: (input: ReplayOrderInput) => { order: { status: string } } | null;
  /** CME 期货合约规格：数量按手取整（qty = 手数 × multiplier），价格按 tick_size 取整 */
  contract?: CmeContract | null;
}

const SIZE_DEFAULT: Record<SizeMode, number> = { risk: 1, notional: 1000, qty: 0.01, lots: 1 };

const OrderPanel: React.FC<OrderPanelProps> = ({ view, disabled, picking, onPickStart, pickResult, onSubmit, contract }) => {
  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [sizeMode, setSizeMode] = useState<SizeMode>('risk');
  const [sizeValue, setSizeValue] = useState<number | null>(SIZE_DEFAULT.risk);
  const [price, setPrice] = useState<number | null>(null);
  const [stopLoss, setStopLoss] = useState<number | null>(null);
  const [takeProfit, setTakeProfit] = useState<number | null>(null);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const unit = quoteUnit(contract);
  const sizeUnit: Record<SizeMode, string> = { risk: '%', notional: unit, qty: '', lots: '手' };
  const tick = contract?.tick_size;
  const snap = (v: number | null) => (v !== null && tick ? roundToTick(v, tick) : v);

  // 换会话时品种可能在币安和期货之间切换，数量模式跟着换
  useEffect(() => {
    const next: SizeMode = contract ? (sizeMode === 'qty' ? 'lots' : sizeMode) : sizeMode === 'lots' ? 'qty' : sizeMode;
    if (next !== sizeMode) {
      setSizeMode(next);
      setSizeValue(SIZE_DEFAULT[next]);
    }
  }, [contract, sizeMode]);

  const last = view.current_bar.close;
  const { equity } = view;
  const { leverage } = view.session;

  // 点图取价的结果落到对应输入框
  useEffect(() => {
    if (!pickResult) return;
    const p = tick ? roundToTick(pickResult.price, tick) : pickResult.price;
    if (pickResult.field === 'price') setPrice(p);
    if (pickResult.field === 'stop_loss') setStopLoss(p);
    if (pickResult.field === 'take_profit') setTakeProfit(p);
  }, [pickResult, tick]);

  // 预估：数量 / 名义价值 / 保证金 / 止损风险
  const estimate = useMemo(() => {
    const ref = orderType === 'market' ? last : price;
    if (!ref || !sizeValue) return null;
    let qty: number | null = null;
    if (sizeMode === 'qty') qty = sizeValue;
    else if (sizeMode === 'lots') qty = contract ? Math.floor(sizeValue) * contract.multiplier : null;
    else if (sizeMode === 'notional') qty = sizeValue / ref;
    else if (stopLoss && Math.abs(ref - stopLoss) > 0) qty = (equity * sizeValue) / 100 / Math.abs(ref - stopLoss);
    if (qty === null) return null;
    // 期货只能整手：按风险 / 金额算出的数量向下取整到 multiplier 的整数倍
    if (contract) qty = Math.floor(qty / contract.multiplier + 1e-9) * contract.multiplier;
    const notional = qty * ref;
    return {
      qty,
      notional,
      margin: notional / leverage,
      risk: stopLoss ? qty * Math.abs(ref - stopLoss) : null,
    };
  }, [orderType, last, price, sizeMode, sizeValue, stopLoss, equity, leverage, contract]);

  const handleSizeMode = (m: SizeMode) => {
    setSizeMode(m);
    setSizeValue(SIZE_DEFAULT[m]);
  };

  // 数量由前端换算：按风险 qty = 权益 × 风险% ÷ |委托价 − 止损价|，按金额 qty = 金额 ÷ 委托价
  const submit = () => {
    if (!sizeValue || sizeValue <= 0) return message.warning('请填写下单数量');
    if (orderType !== 'market' && !price) return message.warning(orderType === 'limit' ? '请填写限价' : '请填写触发价');
    if (sizeMode === 'risk' && !stopLoss) return message.warning('按风险%下单必须设置止损');
    if (contract && estimate && estimate.qty === 0) {
      return message.warning(`不足 1 手（1 手 = ${contract.multiplier} 单位），请加大仓位或放宽止损`);
    }
    if (!estimate || !(estimate.qty > 0) || !Number.isFinite(estimate.qty)) {
      return message.warning('无法计算下单数量，请检查委托价和止损价');
    }

    const res = onSubmit({
      side,
      order_type: orderType,
      qty: estimate.qty,
      price: orderType === 'market' ? null : snap(price),
      stop_loss: snap(stopLoss ?? null),
      take_profit: snap(takeProfit ?? null),
      reduce_only: reduceOnly,
      tags,
      note: note.trim() || null,
    });
    if (res && res.order.status !== 'rejected') {
      setPrice(null);
      setNote('');
    }
  };

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

  const isBuy = side === 'buy';

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>下单</div>

      <div className={styles.sideBtns}>
        <button
          type="button"
          className={`${styles.sideBtn} ${styles.buy} ${isBuy ? styles.active : ''}`}
          onClick={() => setSide('buy')}
          disabled={disabled}
        >
          买入 / 做多
        </button>
        <button
          type="button"
          className={`${styles.sideBtn} ${styles.sell} ${!isBuy ? styles.active : ''}`}
          onClick={() => setSide('sell')}
          disabled={disabled}
        >
          卖出 / 做空
        </button>
      </div>

      <Segmented
        block
        size="small"
        value={orderType}
        onChange={(v) => setOrderType(v as OrderType)}
        options={[
          { label: '市价', value: 'market' },
          { label: '限价', value: 'limit' },
          { label: '条件', value: 'stop' },
        ]}
        disabled={disabled}
      />

      {orderType !== 'market' && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{orderType === 'limit' ? '限价' : '触发价'}</span>
          <InputNumber size="small" value={price} onChange={setPrice} min={0} step={tick} style={{ flex: 1 }} disabled={disabled} />
          {pickBtn('price')}
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>仓位</span>
        <Segmented
          size="small"
          value={sizeMode}
          onChange={(v) => handleSizeMode(v as SizeMode)}
          options={[
            { label: '风险%', value: 'risk' },
            { label: '金额', value: 'notional' },
            contract ? { label: '手数', value: 'lots' } : { label: '数量', value: 'qty' },
          ]}
          disabled={disabled}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel} />
        <InputNumber
          size="small"
          value={sizeValue}
          onChange={setSizeValue}
          min={0}
          precision={sizeMode === 'lots' ? 0 : undefined}
          style={{ flex: 1 }}
          addonAfter={sizeUnit[sizeMode] || undefined}
          disabled={disabled}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>止损</span>
        <InputNumber size="small" value={stopLoss} onChange={setStopLoss} min={0} step={tick} style={{ flex: 1 }} disabled={disabled} />
        {pickBtn('stop_loss')}
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>止盈</span>
        <InputNumber size="small" value={takeProfit} onChange={setTakeProfit} min={0} step={tick} style={{ flex: 1 }} disabled={disabled} />
        {pickBtn('take_profit')}
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>标签</span>
        <Select
          mode="tags"
          size="small"
          value={tags}
          onChange={setTags}
          placeholder="复盘标签，如 突破/回踩"
          style={{ flex: 1 }}
          tokenSeparators={[',', '，', ' ']}
          open={false}
          disabled={disabled}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>笔记</span>
        <Input size="small" value={note} onChange={(e) => setNote(e.target.value)} placeholder="开仓理由" disabled={disabled} />
      </div>

      <Checkbox checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} disabled={disabled}>
        <span className={styles.dim}>只减仓</span>
      </Checkbox>

      <div className={styles.estimate}>
        {estimate ? (
          <>
            <span className={contract && estimate.qty === 0 ? styles.neg : undefined}>
              数量 {contract && estimate.qty === 0 ? '不足 1 手' : fmtSize(estimate.qty, contract)}
            </span>
            <span>名义 {fmtUsd(estimate.notional)}{unit}</span>
            <span>保证金 {fmtUsd(estimate.margin)}{unit}</span>
            {estimate.risk !== null && <span className={styles.neg}>止损风险 {fmtUsd(estimate.risk)}{unit}</span>}
          </>
        ) : (
          <span className={styles.dim}>
            {sizeMode === 'risk' && !stopLoss ? '按风险%下单需先填止损' : '填写后显示预估'}
          </span>
        )}
      </div>

      <Button
        block
        type="primary"
        disabled={disabled}
        onClick={submit}
        className={isBuy ? styles.submitBuy : styles.submitSell}
      >
        {isBuy ? '买入' : '卖出'}
        {orderType === 'market' ? ' · 市价' : orderType === 'limit' ? ' · 限价' : ' · 条件'}
      </Button>
    </div>
  );
};

export default OrderPanel;
