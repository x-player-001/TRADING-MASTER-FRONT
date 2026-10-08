import React, { useEffect, useState } from 'react';
import { Modal, Form, AutoComplete, DatePicker, Input, InputNumber, Button, Collapse, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import styles from './Replay.module.scss';
import { regularSessionOf } from './tradingSession';
import { replayAPI, CmeContract, DataCoverage, ReplaySessionState, ReplaySymbols } from '../../services/replayAPI';

interface CreateSessionModalProps {
  open: boolean;
  onClose: () => void;
  /** 创建接口返回完整状态（与 GET /sessions/:id 相同），可直接用来打开会话 */
  onCreated: (state: ReplaySessionState) => void;
}

interface FormValues {
  symbol: string;
  start: Dayjs;
  name?: string;
  initial_balance: number;
  leverage: number;
  taker_fee_pct: number;
  maker_fee_pct: number;
  slippage_pct: number;
  note?: string;
}

const FALLBACK_SYMBOLS: ReplaySymbols = {
  crypto: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'].map((symbol) => ({ symbol, avg_quote_volume_30d: 0 })),
  cme: [],
};

// 币安品种的默认参数；CME 期货用 /cme-contracts 里的默认值（1 手 ES 名义价值 30 多万美元，1 万资金开不了仓）
const CRYPTO_DEFAULTS = { initial_balance: 10000, leverage: 10, taker_fee_pct: 0.05, maker_fee_pct: 0.02 };
const cmeDefaults = (c: CmeContract) => ({
  initial_balance: c.default_balance,
  leverage: c.default_leverage,
  taker_fee_pct: c.default_fee_rate * 100,
  maker_fee_pct: c.default_fee_rate * 100,
});

const fmtVolume = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(0)}M`);

const parseYmd = (s: string): Dayjs => dayjs(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
const fmtYmd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

// 随机起点：按天数加权选一段，避开段首（留出历史K线）和段尾（留出回放空间）
const randomStart = (coverage: DataCoverage[]): Dayjs | null => {
  const usable = coverage.filter((c) => c.days >= 6);
  const total = usable.reduce((s, c) => s + c.days - 5, 0);
  if (!total) return null;
  let r = Math.random() * total;
  for (const c of usable) {
    const span = c.days - 5;
    if (r < span) {
      const day = parseYmd(c.start_date).add(3 + Math.floor(r), 'day');
      return day.hour(Math.floor(Math.random() * 24)).minute(0).second(0);
    }
    r -= span;
  }
  return null;
};

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({ open, onClose, onCreated }) => {
  const [form] = Form.useForm<FormValues>();
  const [coverage, setCoverage] = useState<DataCoverage[]>([]);
  const [symbols, setSymbols] = useState<ReplaySymbols>(FALLBACK_SYMBOLS);
  const [submitting, setSubmitting] = useState(false);
  // 下拉只按用户键入的文字过滤：输入框里已有的值（默认 BTCUSDT、刚选中的项）不参与，打开时显示全部推荐
  const [symbolSearch, setSymbolSearch] = useState('');

  const symbolInput = (Form.useWatch('symbol', form) ?? '').trim().toUpperCase();
  const cme = symbols.cme.find((c) => c.symbol === symbolInput) ?? null;
  // 币安各币种共用一份覆盖范围；期货按品种取
  const coverageKey = cme ? cme.symbol : '';

  useEffect(() => {
    if (!open) return;
    replayAPI
      .getSymbols()
      .then((res) => res?.crypto?.length && setSymbols(res))
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    replayAPI
      .getDataCoverage(coverageKey || undefined)
      .then((c) => !stale && setCoverage(c))
      .catch(() => !stale && setCoverage([]));
    return () => { stale = true; };
  }, [open, coverageKey]);

  // 在币安和期货之间切换时换一套默认资金 / 杠杆 / 手续费；同类之间切换保留手动改过的值
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(cme ? cmeDefaults(cme) : CRYPTO_DEFAULTS);
    // 已选的起点不在新品种的数据范围里就清掉
    form.setFieldValue('start', undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, coverageKey]);

  const symbolOptions = [
    {
      label: '热门币种（近 30 天日均成交额）',
      options: symbols.crypto.map((s) => ({
        value: s.symbol,
        label: (
          <span className={styles.symbolOption}>
            {s.symbol}
            {s.avg_quote_volume_30d > 0 && <span className={styles.dim}>{fmtVolume(s.avg_quote_volume_30d)}</span>}
          </span>
        ),
      })),
    },
    ...(symbols.cme.length
      ? [{
          label: 'CME 期货',
          options: symbols.cme.map((c) => ({
            value: c.symbol,
            label: (
              <span className={styles.symbolOption}>
                {c.symbol}
                <span className={styles.dim}>{c.name}</span>
              </span>
            ),
          })),
        }]
      : []),
  ];

  const inCoverage = (d: Dayjs) => {
    const ymd = d.format('YYYYMMDD');
    return coverage.some((c) => ymd >= c.start_date && ymd <= c.end_date);
  };

  const submit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      const snap = await replayAPI.createSession({
        symbol: v.symbol.trim().toUpperCase(),
        start_time: v.start.valueOf(),
        name: v.name?.trim() || undefined,
        initial_balance: v.initial_balance,
        leverage: v.leverage,
        taker_fee_rate: v.taker_fee_pct / 100,
        maker_fee_rate: v.maker_fee_pct / 100,
        slippage_rate: v.slippage_pct / 100,
        note: v.note?.trim() || undefined,
      });
      message.success('回放会话已创建');
      form.resetFields();
      onCreated(snap);
    } catch (err) {
      message.error((err as Error).message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="新建K线回放"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="开始回放"
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ symbol: 'BTCUSDT', ...CRYPTO_DEFAULTS, slippage_pct: 0 }}
      >
        <Form.Item
          name="symbol"
          label="品种"
          rules={[{ required: true, message: '请选择品种' }]}
          extra={
            cme
              ? `${cme.name}：连续合约（不复权，换月处有跳空），${
                  regularSessionOf(cme.symbol) ? '只有美股常规时段（美东 9:30~16:00），每天开盘有跳空' : '有日内和周末休市'
                }；1 手 = ${cme.multiplier} 单位，最小变动 ${cme.tick_size}`
              : '列表外的币安合约只要有 5m 数据也能直接输入'
          }
        >
          <AutoComplete
            options={symbolOptions}
            onSearch={setSymbolSearch}
            onSelect={() => setSymbolSearch('')}
            onDropdownVisibleChange={(visible) => !visible && setSymbolSearch('')}
            filterOption={(_, opt) =>
              String((opt as { value?: string } | undefined)?.value ?? '').includes(symbolSearch.trim().toUpperCase())
            }
            placeholder="如 BTCUSDT、ES、GC"
          />
        </Form.Item>

        <Form.Item label="起点（北京时间）" required>
          <div className={styles.startRow}>
            <Form.Item name="start" noStyle rules={[{ required: true, message: '请选择起点' }]}>
              <DatePicker
                showTime={{ format: 'HH:mm', minuteStep: 5 }}
                format="YYYY-MM-DD HH:mm"
                disabledDate={(d) => coverage.length > 0 && !inCoverage(d)}
                style={{ flex: 1 }}
              />
            </Form.Item>
            <Button
              onClick={() => {
                const d = randomStart(coverage);
                if (d) form.setFieldValue('start', d);
                else message.warning('没有可用的数据段');
              }}
            >
              🎲 随机
            </Button>
          </div>
          {coverage.length > 0 && (
            <div className={styles.coverage}>
              <span className={styles.dim}>有数据的区间：</span>
              {coverage.map((c) => (
                <span key={c.start_date} className={styles.coverageTag}>
                  {fmtYmd(c.start_date)} ~ {fmtYmd(c.end_date)}（{c.days}天）
                </span>
              ))}
            </div>
          )}
        </Form.Item>

        <Form.Item name="name" label="名称">
          <Input placeholder="可选，如「BTC 趋势回调练习」" />
        </Form.Item>

        <div className={styles.formRow}>
          <Form.Item name="initial_balance" label={`初始资金 (${cme ? 'USD' : 'USDT'})`} style={{ flex: 1 }}>
            <InputNumber min={100} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="leverage" label="杠杆" style={{ flex: 1 }}>
            <InputNumber min={1} max={125} style={{ width: '100%' }} addonAfter="x" />
          </Form.Item>
        </div>

        <Collapse
          size="small"
          ghost
          items={[
            {
              key: 'fee',
              label: '手续费与滑点',
              forceRender: true,
              children: (
                <div className={styles.formRow}>
                  <Form.Item name="taker_fee_pct" label="Taker %" style={{ flex: 1 }}>
                    <InputNumber min={0} step={cme ? 0.001 : 0.01} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="maker_fee_pct" label="Maker %" style={{ flex: 1 }}>
                    <InputNumber min={0} step={cme ? 0.001 : 0.01} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="slippage_pct" label="滑点 %" style={{ flex: 1 }}>
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />

        <Form.Item name="note" label="备注" style={{ marginTop: 8 }}>
          <Input.TextArea rows={2} placeholder="本次练习的目标，如「只做回踩不追高」" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateSessionModal;
