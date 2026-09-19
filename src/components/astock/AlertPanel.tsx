import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, message, Tooltip, Empty, Segmented, Switch, Input, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import styles from '../../pages/WatchPool.module.scss';
import { DataSection } from '../ui';
import FavStar from './FavStar';
import LimitupBadge, { usePoolLimitupMap } from './LimitupBadge';
import { favoriteAPI } from '../../services/favoriteAPI';
import {
  pullbackAPI,
  PullbackAlert,
  PullbackRhythm,
  distLevel,
} from '../../services/pullbackAPI';

interface AlertPanelProps {
  refreshKey: number;
  onLoadingChange?: (loading: boolean) => void;
  onOpenKline: (stock: { code: string; name?: string }) => void;
}

const fmtPct = (v: number | null | undefined, withSign = false): string => {
  if (v === null || v === undefined) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

const fmtNum = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined) return '—';
  return v.toFixed(digits);
};

const fmtMoney = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(0);
};

const distClass = (v: number | null | undefined): string => {
  const lv = distLevel(v);
  return lv === 'near' ? styles.good : lv === 'mid' ? styles.normal : styles.warn;
};

const AlertPanel: React.FC<AlertPanelProps> = ({ refreshKey, onLoadingChange, onOpenKline }) => {
  const [alertDate, setAlertDate] = useState<Dayjs | null>(null);
  const [rhythm, setRhythm] = useState<PullbackRhythm | 'all'>('all');
  const [onlyFav, setOnlyFav] = useState(false);
  const [keyword, setKeyword] = useState('');

  const [list, setList] = useState<PullbackAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const limitupMap = usePoolLimitupMap(refreshKey);
  const [favCodes, setFavCodes] = useState<Set<string>>(new Set());
  const loadFavCodes = useCallback(async () => {
    try {
      setFavCodes(new Set(await favoriteAPI.getCodes()));
    } catch (err) {
      console.error('加载收藏列表失败:', err);
    }
  }, []);
  useEffect(() => { loadFavCodes(); }, [loadFavCodes]);
  const handleFavChange = useCallback((code: string, faved: boolean) => {
    setFavCodes((prev) => {
      const next = new Set(prev);
      if (faved) next.add(code); else next.delete(code);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const data = await pullbackAPI.getAlerts({
        alert_date: alertDate ? alertDate.format('YYYY-MM-DD') : undefined,
        rhythm: rhythm === 'all' ? undefined : rhythm,
        only_fav: onlyFav || undefined,
      });
      setList(data ?? []);
    } catch (err: any) {
      message.error(err?.message || '加载盘中预警失败');
      setList([]);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertDate, rhythm, onlyFav]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(
      (r) => r.name?.toLowerCase().includes(kw) || r.code?.toLowerCase().includes(kw)
    );
  }, [list, keyword]);

  // confirmed 是整套机制的自检指标：统计它才知道 14:45 这个时点准不准。
  // null 表示尚未回填（当日的必然如此），不能算进分母。
  const settled = list.filter((r) => r.confirmed !== null);
  const confirmedCount = settled.filter((r) => r.confirmed).length;
  const accuracy = settled.length ? (confirmedCount / settled.length) * 100 : null;

  const snapshot = list[0]?.snapshot_at ?? null;
  const shownDate = list[0]?.alert_date ?? (alertDate ? alertDate.format('YYYY-MM-DD') : null);

  const columns: ColumnsType<PullbackAlert> = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 122,
      fixed: 'left',
      render: (code: string, row) => (
        <span className={styles.codeCell}>
          <FavStar code={code} favCodes={favCodes} onChange={handleFavChange} />
          <a className={styles.codeLink} onClick={() => onOpenKline({ code, name: row.name })}>{code}</a>
        </span>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 116,
      fixed: 'left',
      render: (name: string, row) => (
        <span className={styles.nameCell}>
          <a className={styles.nameLink} onClick={() => onOpenKline({ code: row.code, name })}>{name}</a>
          <LimitupBadge code={row.code} map={limitupMap} />
        </span>
      ),
    },
    {
      title: '节奏',
      dataIndex: 'rhythm',
      key: 'rhythm',
      width: 72,
      align: 'center',
      render: (r: PullbackRhythm | null) => {
        if (!r) return <span className={styles.muted}>—</span>;
        const hint =
          r === '急' ? '若涨停预计 T+1~T+2（实测快速涨停 11.90%）'
            : r === '中' ? '若涨停预计一周内（实测快速涨停 3.58%）'
              : '不具备急涨特征，是排除法的结果，总命中仅 8.19%';
        return (
          <Tooltip title={`${hint}。返回已按 急→中→缓 排序`}>
            <Tag color={r === '急' ? 'red' : r === '中' ? 'orange' : 'default'}>{r}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '预警价',
      dataIndex: 'last_price',
      key: 'last_price',
      width: 92,
      align: 'right',
      render: (v: number | null) => (
        <Tooltip title="14:45 的盘中实时价，非收盘价">
          <span>{fmtNum(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: '距高点',
      dataIndex: 'drawdown_from_peak',
      key: 'drawdown_from_peak',
      width: 94,
      align: 'right',
      sorter: (a, b) => (a.drawdown_from_peak ?? 0) - (b.drawdown_from_peak ?? 0),
      render: (v: number | null) => <span className={styles.negative}>{fmtPct(v)}</span>,
    },
    {
      title: '距MA5',
      dataIndex: 'dist_ma5',
      key: 'dist_ma5',
      width: 88,
      align: 'right',
      sorter: (a, b) => Math.abs(a.dist_ma5 ?? 99) - Math.abs(b.dist_ma5 ?? 99),
      render: (v: number | null) => <span className={distClass(v)}>{fmtPct(v, true)}</span>,
    },
    {
      title: '距MA10',
      dataIndex: 'dist_ma10',
      key: 'dist_ma10',
      width: 92,
      align: 'right',
      sorter: (a, b) => Math.abs(a.dist_ma10 ?? 99) - Math.abs(b.dist_ma10 ?? 99),
      render: (v: number | null) => <span className={distClass(v)}>{fmtPct(v, true)}</span>,
    },
    {
      title: '回踩天数',
      dataIndex: 'pullback_days',
      key: 'pullback_days',
      width: 90,
      align: 'right',
      render: (v: number | null) => <span className={styles.muted}>{v == null ? '—' : `${v}天`}</span>,
    },
    {
      title: '突破日',
      dataIndex: 'breakout_date',
      key: 'breakout_date',
      width: 106,
      render: (d: string | null, row) => (
        <Tooltip title={row.breakout_boards ? `突破段 ${row.breakout_boards} 板` : '突破段未连板'}>
          <span className={styles.muted}>{d ?? '—'}</span>
        </Tooltip>
      ),
    },
    {
      title: '距低点',
      dataIndex: 'gain_from_low',
      key: 'gain_from_low',
      width: 92,
      align: 'right',
      sorter: (a, b) => (a.gain_from_low ?? 0) - (b.gain_from_low ?? 0),
      render: (v: number | null) => fmtPct(v),
    },
    {
      title: '量比',
      dataIndex: 'vol20',
      key: 'vol20',
      width: 84,
      align: 'right',
      render: (v: number | null) => (
        <Tooltip title="相对20日均量">
          <span>{fmtNum(v)}x</span>
        </Tooltip>
      ),
    },
    {
      title: '成交额',
      dataIndex: 'amount',
      key: 'amount',
      width: 96,
      align: 'right',
      sorter: (a, b) => (a.amount ?? 0) - (b.amount ?? 0),
      render: (v: number | null) => <span className={styles.muted}>{fmtMoney(v)}</span>,
    },
    {
      title: '次日回填',
      dataIndex: 'confirmed',
      key: 'confirmed',
      width: 100,
      align: 'center',
      render: (v: boolean | null) =>
        v === null ? (
          <Tooltip title="尚未回填——当日预警要等次日收盘后才知道是否真的入池">
            <span className={styles.muted}>待回填</span>
          </Tooltip>
        ) : v ? (
          <Tooltip title="收盘后确认真的入池了，这次预判是对的"><Tag color="green">已确认</Tag></Tooltip>
        ) : (
          <Tooltip title="收盘后未入池——尾盘被拉走或砸穿，这次预判没成立"><Tag color="default">未成立</Tag></Tooltip>
        ),
    },
  ];

  return (
    <>
      {/* 最重要的一句：这是预判不是确认 */}
      <div className={styles.noticeHint}>
        ⚠️ <strong>这是 14:45 的盘中预判，不是确认。</strong>
        判据用盘中实时价代替收盘价，<strong>尾盘 15 分钟可能拉走或砸穿</strong>，名单里会有一部分收盘时不成立。
        它与回踩池的正式入池（18:30 收盘后）是两张表、两个口径，不要混为一谈。
      </div>

      <DataSection
        className={styles.section}
        title="盘中回踩预警"
        subtitle={
          [
            shownDate ? `${shownDate} 14:45` : null,
            keyword.trim() ? `${filtered.length} / ${list.length} 只` : `${list.length} 只`,
            snapshot ? `抓取 ${snapshot.slice(11, 16)}` : null,
          ].filter(Boolean).join(' · ')
        }
        headerActions={
          <div className={styles.filters}>
            {/* 自检指标：不显示的话用户无从判断该信任多少 */}
            <Tooltip
              title={
                accuracy === null
                  ? '次日回填后才能统计。当日预警的 confirmed 均为 null，属正常'
                  : `已回填 ${settled.length} 条，其中 ${confirmedCount} 条收盘后真的入池`
              }
            >
              <span className={styles.switchWrap}>
                <span className={styles.switchLabel}>历史准确率</span>
                <b className={accuracy === null ? styles.muted : styles.scoreVal}>
                  {accuracy === null ? '尚无回填样本' : `${accuracy.toFixed(0)}%`}
                </b>
              </span>
            </Tooltip>
            <Input.Search
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索名称/代码"
              allowClear
              size="small"
              style={{ width: 150 }}
            />
            <DatePicker
              value={alertDate}
              onChange={setAlertDate}
              allowClear
              size="small"
              placeholder="预警日"
              disabledDate={(d) => d && d > dayjs().endOf('day')}
            />
            <Segmented
              size="small"
              value={rhythm}
              onChange={(v) => setRhythm(v as PullbackRhythm | 'all')}
              options={[
                { label: '全部', value: 'all' },
                { label: '急', value: '急' },
                { label: '中', value: '中' },
                { label: '缓', value: '缓' },
              ]}
            />
            <Tooltip title="只看已收藏的票">
              <span className={styles.switchWrap}>
                <Switch size="small" checked={onlyFav} onChange={setOnlyFav} />
                <span className={styles.switchLabel}>只看收藏</span>
              </span>
            </Tooltip>
          </div>
        }
      >
        <Table<PullbackAlert>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 30, showSizeChanger: false, showTotal: (t) => `共 ${t} 只` }}
          scroll={{ x: 1254 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  keyword.trim()
                    ? `未匹配到「${keyword.trim()}」`
                    : '当日无预警（14:45 之前或当天没有符合条件的票）'
                }
              />
            ),
          }}
        />
      </DataSection>
    </>
  );
};

export default AlertPanel;
