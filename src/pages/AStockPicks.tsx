import React, { useState, useEffect, useCallback } from 'react';
import { DatePicker, Tabs, Table, Tag, Drawer, message, Tooltip, Empty, Segmented } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import styles from './AStockPicks.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../components/ui';
import AStockKlineModal from '../components/astock/AStockKlineModal';
import {
  astockAPI,
  DailyPicks,
  Pick,
  StockDetail,
  ValidationReport,
  DailyValidation,
  ParamVersion,
  BoardGroup,
  StrategyVersion,
  FACTOR_LABELS,
} from '../services/astockAPI';

const VERSION_OPTIONS = [
  { label: 'A套 · 不看板块', value: 'v1' },
  { label: 'B套 · 结合板块', value: 'v2' },
];

interface AStockPicksProps {
  isSidebarCollapsed?: boolean;
}

// ── 工具函数 ───────────────────────────────────────────
// 后端返回的已是百分比数值（如 -0.9211 即 -0.92%），直接加 % 号，不再乘100
const fmtPct = (v: number | null | undefined, withSign = false): string => {
  if (v === null || v === undefined) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

const fmtNum = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined) return '—';
  return v.toFixed(digits);
};

const retClass = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  return v > 0 ? styles.positive : v < 0 ? styles.negative : '';
};

const AStockPicks: React.FC<AStockPicksProps> = ({ isSidebarCollapsed = false }) => {
  // 策略版本
  const [version, setVersion] = useState<StrategyVersion>('v1');

  // 顶部日期
  const [date, setDate] = useState<Dayjs | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());

  // 每日选股
  const [dailyPicks, setDailyPicks] = useState<DailyPicks | null>(null);
  const [boardGroup, setBoardGroup] = useState<BoardGroup>('main');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // K线弹窗
  const [klineStock, setKlineStock] = useState<{ code: string; name?: string } | null>(null);

  // 个股详情抽屉
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 验证回测
  const [activeTab, setActiveTab] = useState('picks');
  const [reports, setReports] = useState<ValidationReport[]>([]);
  const [validationRows, setValidationRows] = useState<DailyValidation[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);

  // 参数版本
  const [paramVersions, setParamVersions] = useState<ParamVersion[]>([]);

  // ── 加载可选日期 ──────────────────────────────────────
  const loadDates = useCallback(async () => {
    try {
      const dates = await astockAPI.getPickDates(120);
      setAvailableDates(new Set(dates));
    } catch (err) {
      console.error('加载选股日期失败:', err);
    }
  }, []);

  // ── 加载每日选股 ──────────────────────────────────────
  const loadDailyPicks = useCallback(async (d: Dayjs | null, v: StrategyVersion) => {
    setLoading(true);
    try {
      const data = await astockAPI.getDailyPicks(d ? d.format('YYYY-MM-DD') : undefined, v);
      setDailyPicks(data);
      // 首次进入未选日期时，回填为后端返回的交易日
      if (!d && data?.trade_date) {
        setDate(dayjs(data.trade_date));
      }
    } catch (err: any) {
      message.error(err?.message || '加载选股数据失败');
      setDailyPicks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── 加载验证回测 ──────────────────────────────────────
  const loadValidation = useCallback(async (d: Dayjs | null, v: StrategyVersion) => {
    setValidationLoading(true);
    try {
      const [summary, daily] = await Promise.all([
        astockAPI.getValidationSummary(12, v),
        d ? astockAPI.getDailyValidation(d.format('YYYY-MM-DD'), v).catch(() => []) : Promise.resolve([]),
      ]);
      setReports(summary);
      setValidationRows(daily);
    } catch (err) {
      console.error('加载验证数据失败:', err);
    } finally {
      setValidationLoading(false);
    }
  }, []);

  const loadParamVersions = useCallback(async () => {
    try {
      setParamVersions(await astockAPI.getParamVersions());
    } catch (err) {
      console.error('加载参数版本失败:', err);
    }
  }, []);

  // 初始化 / 切换版本时重新加载选股
  useEffect(() => {
    loadDates();
    loadDailyPicks(date, version);
    loadParamVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // 切到验证Tab / 日期 / 版本变化时按需加载验证数据
  useEffect(() => {
    if (activeTab === 'validation') {
      loadValidation(date, version);
    }
  }, [activeTab, date, version, loadValidation]);

  // 刷新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadDates(),
      loadDailyPicks(date, version),
      activeTab === 'validation' ? loadValidation(date, version) : Promise.resolve(),
    ]);
    setIsRefreshing(false);
  };

  // 选日期
  const handleDateChange = (d: Dayjs | null) => {
    setDate(d);
    loadDailyPicks(d, version);
  };

  // 打开个股详情
  const openDetail = async (code: string) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await astockAPI.getStockDetail(code, 30));
    } catch (err: any) {
      message.error(err?.message || '加载个股详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const market = dailyPicks?.market;

  // ── 选股表格列 ────────────────────────────────────────
  const pickColumns: ColumnsType<Pick> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (rank: number) => (
        <span className={`${styles.rankBadge} ${rank <= 3 ? styles.rankTop : ''}`}>{rank}</span>
      ),
    },
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string, row) => (
        <a className={styles.codeLink} onClick={() => setKlineStock({ code, name: row.name })}>{code}</a>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name: string, row) => (
        <a className={styles.nameLink} onClick={() => openDetail(row.code)}>{name}</a>
      ),
    },
    {
      title: '综合评分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 130,
      sorter: (a, b) => a.total_score - b.total_score,
      render: (score: number) => {
        const val = score * 100;
        const pct = Math.max(0, Math.min(100, val));
        return (
          <div className={styles.scoreCell}>
            <div className={styles.scoreBarTrack}>
              <div className={styles.scoreBarFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.scoreVal}>{val.toFixed(1)}</span>
          </div>
        );
      },
    },
    {
      title: '收盘价',
      dataIndex: 'decision_raw_close',
      key: 'decision_raw_close',
      width: 90,
      align: 'right',
      render: (v: number | null) => fmtNum(v),
    },
    {
      title: '入选理由',
      dataIndex: 'reasons',
      key: 'reasons',
      ellipsis: true,
      render: (reasons: string | null) =>
        reasons ? (
          <Tooltip title={reasons}>
            <span className={styles.reasons}>{reasons}</span>
          </Tooltip>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      title: '参数版本',
      dataIndex: 'param_version',
      key: 'param_version',
      width: 150,
      render: (v: string, row) => {
        const dual = row.also_in_versions && row.also_in_versions.length > 0;
        const allVersions = [v, ...(row.also_in_versions ?? [])];
        return (
          <span className={styles.versionCell}>
            <span className={styles.muted}>{v}</span>
            {dual && (
              <Tooltip title={`双选：${allVersions.join('、')} 两套策略均选中，信号更强`}>
                <span className={styles.dualBadge}>双选</span>
              </Tooltip>
            )}
          </span>
        );
      },
    },
  ];

  // ── 验证报告表格列 ────────────────────────────────────
  const reportColumns: ColumnsType<ValidationReport> = [
    {
      title: '周期',
      key: 'period',
      width: 200,
      render: (_, r) => `${r.period_start} ~ ${r.period_end}`,
    },
    { title: '参数版本', dataIndex: 'param_version', key: 'param_version', width: 110 },
    { title: '选股数', dataIndex: 'pick_count', key: 'pick_count', width: 80, align: 'right' },
    { title: '可交易', dataIndex: 'tradable_count', key: 'tradable_count', width: 80, align: 'right' },
    {
      title: '命中率(7%)',
      dataIndex: 'hit_rate_7pct',
      key: 'hit_rate_7pct',
      width: 110,
      align: 'right',
      render: (v) => <span className={retClass(v)}>{fmtPct(v)}</span>,
    },
    {
      title: 'T3均高收益',
      dataIndex: 'avg_t3_high_ret',
      key: 'avg_t3_high_ret',
      width: 110,
      align: 'right',
      render: (v) => <span className={retClass(v)}>{fmtPct(v, true)}</span>,
    },
    {
      title: '盈亏比',
      dataIndex: 'avg_profit_loss_ratio',
      key: 'avg_profit_loss_ratio',
      width: 90,
      align: 'right',
      render: (v) => fmtNum(v),
    },
    {
      title: '基准收益',
      dataIndex: 'benchmark_market_ret',
      key: 'benchmark_market_ret',
      width: 100,
      align: 'right',
      render: (v) => <span className={retClass(v)}>{fmtPct(v, true)}</span>,
    },
    {
      title: '超额(vs随机)',
      dataIndex: 'edge_over_random',
      key: 'edge_over_random',
      width: 120,
      align: 'right',
      render: (v) => <span className={`${styles.edge} ${retClass(v)}`}>{fmtPct(v, true)}</span>,
    },
  ];

  // ── 每日验证明细表格列 ────────────────────────────────
  const validationColumns: ColumnsType<DailyValidation> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (rank: number) => (
        <span className={`${styles.rankBadge} ${rank <= 3 ? styles.rankTop : ''}`}>{rank}</span>
      ),
    },
    { title: '代码', dataIndex: 'code', key: 'code', width: 100, render: (c: string, row) => <a className={styles.codeLink} onClick={() => setKlineStock({ code: c, name: row.name })}>{c}</a> },
    { title: '名称', dataIndex: 'name', key: 'name', width: 110, render: (name: string, row) => <a className={styles.nameLink} onClick={() => openDetail(row.code)}>{name}</a> },
    {
      title: '评分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 80,
      align: 'right',
      render: (s: number) => <span className={styles.scoreVal}>{(s * 100).toFixed(1)}</span>,
    },
    {
      title: '板块',
      dataIndex: 'board_group',
      key: 'board_group',
      width: 80,
      align: 'center',
      render: (g: string) => <Tag color={g === 'main' ? 'blue' : 'default'}>{g === 'main' ? '主板' : '非主板'}</Tag>,
    },
    { title: 'T1最高', dataIndex: 't1_high_ret', key: 't1_high_ret', width: 90, align: 'right', render: (v) => <span className={retClass(v)}>{fmtPct(v, true)}</span> },
    { title: 'T2最高', dataIndex: 't2_high_ret', key: 't2_high_ret', width: 90, align: 'right', render: (v) => <span className={retClass(v)}>{fmtPct(v, true)}</span> },
    { title: 'T3最高', dataIndex: 't3_high_ret', key: 't3_high_ret', width: 90, align: 'right', render: (v) => <span className={retClass(v)}>{fmtPct(v, true)}</span> },
    { title: 'T3收盘', dataIndex: 't3_close_ret', key: 't3_close_ret', width: 90, align: 'right', render: (v) => <span className={retClass(v)}>{fmtPct(v, true)}</span> },
    { title: '最大回撤', dataIndex: 'max_drawdown', key: 'max_drawdown', width: 100, align: 'right', render: (v) => <span className={styles.negative}>{fmtPct(v)}</span> },
  ];

  // ── 选股榜 Tab 内容 ───────────────────────────────────
  const picksTab = (
    <>
      {market && (
        <div className={`${styles.marketBar} ${dailyPicks?.actionable ? '' : styles.marketBarWarn}`}>
          <div className={styles.marketItem}>
            <span className={styles.marketLabel}>交易日</span>
            <span className={styles.marketValue}>{market.trade_date}</span>
          </div>
          <div className={styles.marketItem}>
            <span className={styles.marketLabel}>上证</span>
            <span className={`${styles.marketValue} ${retClass(market.sh_pct_chg)}`}>{fmtPct(market.sh_pct_chg, true)}</span>
          </div>
          <div className={styles.marketItem}>
            <span className={styles.marketLabel}>创业板</span>
            <span className={`${styles.marketValue} ${retClass(market.gem_pct_chg)}`}>{fmtPct(market.gem_pct_chg, true)}</span>
          </div>
          <div className={styles.marketItem}>
            <span className={styles.marketLabel}>MA20</span>
            <Tag color={market.below_ma20 ? 'red' : 'green'}>{market.below_ma20 ? '跌破' : '站上'}</Tag>
          </div>
          <div className={styles.marketDecision}>
            <Tag color={dailyPicks?.actionable ? 'green' : 'orange'}>
              {dailyPicks?.actionable ? '✓ 适合操作' : '⚠ 谨慎/空仓'}
            </Tag>
            {market.reason && <span className={styles.marketReason}>{market.reason}</span>}
          </div>
        </div>
      )}

      <DataSection
        className={styles.section}
        title="选股榜单"
        headerActions={
          <Segmented
            value={boardGroup}
            onChange={(v) => setBoardGroup(v as BoardGroup)}
            options={[
              { label: `主板 (${dailyPicks?.main.length ?? 0})`, value: 'main' },
              { label: `非主板 (${dailyPicks?.other.length ?? 0})`, value: 'other' },
            ]}
          />
        }
      >
        <Table<Pick>
          rowKey="id"
          columns={pickColumns}
          dataSource={(boardGroup === 'main' ? dailyPicks?.main : dailyPicks?.other) ?? []}
          loading={loading}
          size="middle"
          pagination={false}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty description={`当日无${boardGroup === 'main' ? '主板' : '非主板'}选股`} /> }}
        />
      </DataSection>
    </>
  );

  // ── 验证回测 Tab 内容 ─────────────────────────────────
  const mainValidationRows = validationRows.filter((r) => r.board_group === 'main');
  const otherValidationRows = validationRows.filter((r) => r.board_group === 'other');

  const validationTab = (
    <>
      <DataSection className={styles.section} title="周期验证报告" collapsible defaultCollapsed>
        <Table<ValidationReport>
          rowKey="id"
          columns={reportColumns}
          dataSource={reports}
          loading={validationLoading}
          size="middle"
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </DataSection>
      <DataSection
        className={styles.section}
        title={`每日验证明细${date ? ` · ${date.format('YYYY-MM-DD')}` : ''}`}
        headerActions={
          <Segmented
            value={boardGroup}
            onChange={(v) => setBoardGroup(v as BoardGroup)}
            options={[
              { label: `主板 (${mainValidationRows.length})`, value: 'main' },
              { label: `非主板 (${otherValidationRows.length})`, value: 'other' },
            ]}
          />
        }
      >
        <Table<DailyValidation>
          rowKey="snapshot_id"
          columns={validationColumns}
          dataSource={boardGroup === 'main' ? mainValidationRows : otherValidationRows}
          loading={validationLoading}
          size="middle"
          pagination={false}
          scroll={{ x: 960 }}
          locale={{ emptyText: <Empty description={date ? `当日无${boardGroup === 'main' ? '主板' : '非主板'}验证明细` : '选择上方日期查看当日验证明细'} /> }}
        />
      </DataSection>
    </>
  );

  // ── 参数版本 Tab 内容 ─────────────────────────────────
  const paramTab = (
    <DataSection title="参数版本">
      <div className={styles.versionGrid}>
        {paramVersions.length === 0 && <Empty description="暂无参数版本" />}
        {paramVersions.map((v) => (
          <div key={v.version} className={`${styles.versionCard} ${v.is_active ? styles.versionActive : ''}`}>
            <div className={styles.versionHead}>
              <span className={styles.versionName}>{v.version}</span>
              {v.is_active && <Tag color="green">生效中</Tag>}
            </div>
            <div className={styles.versionDesc}>{v.description || '无描述'}</div>
            <div className={styles.versionTime}>{dayjs(v.created_at).format('YYYY-MM-DD HH:mm')}</div>
          </div>
        ))}
      </div>
    </DataSection>
  );

  return (
    <div className={`${styles.astockPicks} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={loading || isRefreshing} />

      <PageHeader title="A股选股" subtitle="基于多因子打分的每日Top选股与策略验证" icon="🇨🇳">
        <div className={styles.headerActions}>
          <Segmented
            value={version}
            onChange={(v) => setVersion(v as StrategyVersion)}
            options={VERSION_OPTIONS}
          />
          <DatePicker
            value={date}
            onChange={handleDateChange}
            allowClear={false}
            placeholder="选择交易日"
            disabledDate={(cur) => availableDates.size > 0 && !availableDates.has(cur.format('YYYY-MM-DD'))}
          />
          <CoolRefreshButton onClick={handleRefresh} loading={isRefreshing} />
        </div>
      </PageHeader>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'picks', label: '每日选股', children: picksTab },
          { key: 'validation', label: '验证回测', children: validationTab },
          { key: 'params', label: '参数版本', children: paramTab },
        ]}
      />

      {/* 个股详情抽屉 */}
      <Drawer
        title={detail ? `${detail.name ?? ''} ${detail.code}` : '个股详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
        loading={detailLoading}
      >
        {detail && (
          <div className={styles.detail}>
            <div className={styles.detailMeta}>
              {detail.industry && <Tag>{detail.industry}</Tag>}
              {detail.board && <Tag color="blue">{detail.board}</Tag>}
            </div>

            <div className={styles.detailSectionTitle}>因子明细（最近）</div>
            {detail.factors[0] ? (
              <div className={styles.factorList}>
                {!detail.factors[0].passed_hard_filter && (
                  <div className={styles.rejectBox}>
                    未通过硬性过滤：{detail.factors[0].reject_reasons || '—'}
                  </div>
                )}
                {Object.entries(FACTOR_LABELS).map(([key, label]) => {
                  const val = ((detail.factors[0] as any)[key] as number) * 100;
                  const pct = Math.max(0, Math.min(100, val));
                  return (
                    <div key={key} className={styles.factorRow}>
                      <span className={styles.factorLabel}>{label}</span>
                      <div className={styles.factorBarTrack}>
                        <div className={styles.factorBarFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.factorVal}>{val.toFixed(1)}</span>
                    </div>
                  );
                })}
                <div className={styles.factorTotal}>
                  <span>总分</span>
                  <span className={styles.factorTotalVal}>{(detail.factors[0].total_score * 100).toFixed(1)}</span>
                </div>
              </div>
            ) : (
              <Empty description="无因子数据" />
            )}

            <div className={styles.detailSectionTitle}>历史入选（{detail.pick_history.length}）</div>
            {detail.pick_history.length > 0 ? (
              <div className={styles.historyList}>
                {detail.pick_history.map((p) => (
                  <div key={p.id} className={styles.historyRow}>
                    <span className={styles.historyDate}>{p.trade_date}</span>
                    <span className={styles.historyRank}>#{p.rank}</span>
                    <span className={styles.historyScore}>{(p.total_score * 100).toFixed(1)}分</span>
                    {p.limit_up && <Tag color="red">涨停</Tag>}
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="无历史入选记录" />
            )}
          </div>
        )}
      </Drawer>

      {/* K线弹窗 */}
      {klineStock && (
        <AStockKlineModal
          code={klineStock.code}
          name={klineStock.name}
          isDark={document.documentElement.classList.contains('dark')}
          sidebarCollapsed={isSidebarCollapsed}
          onClose={() => setKlineStock(null)}
        />
      )}
    </div>
  );
};

export default AStockPicks;
