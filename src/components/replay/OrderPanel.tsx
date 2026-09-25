import React, { useEffect, useMemo, useState } from 'react';
import { InputNumber, Segmented, Select, Checkbox, Input, Button, message } from 'antd';
import styles from './Replay.module.scss';
import type { ReplaySide as OrderSide, ReplayOrderType as OrderType } from '../../services/replayAPI';
import type { ReplayOrderInput } from '../../services/kline_replay/replay_account';
import type { ReplayView } from './useReplaySession';
import { fmtQty, fmtUsd } from './format';

export type PickField = 'price' | 'stop_loss' | 'take_profit' | 'pos_sl' | 'pos_tp';

export interface PickRequest {
  field: PickField;
  price: number;
  nonce: number;
}

type SizeMode = 'risk' | 'notional' | 'qty';

interface OrderPanelProps {
  view: ReplayView;
  disabled: boolean;
  picking: PickField | null;
  onPickStart: (field: PickField | null) => void;
  pickResult: PickRequest | null;
  /** 本地撮合下单；返回的 order.status='rejected' 表示被拒（原因走事件提示） */
  onSubmit: (input: ReplayOrderInput) => { order: { status: string } } | null;
}

const SIZE_UNIT: Record<SizeMode, string> = { risk: '%', notional: 'U', qty: '' };
const SIZE_DEFAULT: Record<SizeMode, number> = { risk: 1, notional: 1000, qty: 0.01 };

const OrderPanel: React.FC<OrderPanelProps> = ({ view, disabled, picking, onPickStart, pickResult, onSubmit }) => {
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

  const last = view.current_bar.close;
  const { equity } = view;
  const { leverage } = view.session;

  // 点图取价的结果落到对应输入框
  useEffect(() => {
    if (!pickResult) return;
    if (pickResult.field === 'price') setPrice(pickResult.price);
    if (pickResult.field === 'stop_loss') setStopLoss(pickResult.price);
    if (pickResult.field === 'take_profit') setTakeProfit(pickResult.price);
  }, [pickResult]);

  // 预估：数量 / 名义价值 / 保证金 / 止损风险
  const estimate = useMemo(() => {
    const ref = orderType === 'market' ? last : price;
    if (!ref || !sizeValue) return null;
    let qty: number | null = null;
    if (sizeMode === 'qty') qty = sizeValue;
    else if (sizeMode === 'notional') qty = sizeValue / ref;
    else if (stopLoss && Math.abs(ref - stopLoss) > 0) qty = (equity * sizeValue) / 100 / Math.abs(ref - stopLoss);
    if (qty === null) return null;
    const notional = qty * ref;
    return {
      qty,
      notional,
      margin: notional / leverage,
      risk: stopLoss ? qty * Math.abs(ref - stopLoss) : null,
    };
  }, [orderType, last, price, sizeMode, sizeValue, stopLoss, equity, leverage]);

  const handleSizeMode = (m: SizeMode) => {
    setSizeMode(m);
    setSizeValue(SIZE_DEFAULT[m]);
  };

  // 数量由前端换算：按风险 qty = 权益 × 风险% ÷ |委托价 − 止损价|，按金额 qty = 金额 ÷ 委托价
  const submit = () => {
    if (!sizeValue || sizeValue <= 0) return message.warning('请填写下单数量');
    if (orderType !== 'market' && !price) return message.warning(orderType === 'limit' ? '请填写限价' : '请填写触发价');
    if (sizeMode === 'risk' && !stopLoss) return message.warning('按风险%下单必须设置止损');
    if (!estimate || !(estimate.qty > 0) || !Number.isFinite(estimate.qty)) {
      return message.warning('无法计算下单数量，请检查委托价和止损价');
    }

    const res = onSubmit({
      side,
      order_type: orderType,
      qty: estimate.qty,
      price: orderType === 'market' ? null : price,
      stop_loss: stopLoss ?? null,
      take_profit: takeProfit ?? null,
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
          <InputNumber size="small" value={price} onChange={setPrice} min={0} style={{ flex: 1 }} disabled={disabled} />
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
            { label: '数量', value: 'qty' },
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
          style={{ flex: 1 }}
          addonAfter={SIZE_UNIT[sizeMode] || undefined}
          disabled={disabled}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>止损</span>
        <InputNumber size="small" value={stopLoss} onChange={setStopLoss} min={0} style={{ flex: 1 }} disabled={disabled} />
        {pickBtn('stop_loss')}
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>止盈</span>
        <InputNumber size="small" value={takeProfit} onChange={setTakeProfit} min={0} style={{ flex: 1 }} disabled={disabled} />
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
            <span>数量 {fmtQty(estimate.qty)}</span>
            <span>名义 {fmtUsd(estimate.notional)}U</span>
            <span>保证金 {fmtUsd(estimate.margin)}U</span>
            {estimate.risk !== null && <span className={styles.neg}>止损风险 {fmtUsd(estimate.risk)}U</span>}
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
