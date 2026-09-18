import React, { useState, useEffect, useCallback } from 'react';
import { Table, message, Tooltip, Empty, Input, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import styles from '../../pages/WatchPool.module.scss';
import { DataSection } from '../ui';
import { favoriteAPI, Favorite } from '../../services/favoriteAPI';
import { astockAPI } from '../../services/astockAPI';

interface FavoritePanelProps {
  refreshKey: number;
  onLoadingChange?: (loading: boolean) => void;
  onOpenKline: (stock: { code: string; name?: string }) => void;
  /** 收藏增删后同步给其他池子的星标 */
  onFavChange?: () => void;
}

// 后端数值字段会在 number / 数字字符串 / null 之间变动（K线的 OHLC 实测是字符串），
// 统一转换后再计算，避免字符串参与运算得出 NaN
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const fmtNum = (v: number | null, digits = 2): string =>
  v === null ? '—' : v.toFixed(digits);

const fmtPct = (v: number | null, withSign = true): string => {
  if (v === null) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

const retClass = (v: number | null): string =>
  v === null ? '' : v > 0 ? styles.positive : v < 0 ? styles.negative : '';

// 收藏行 + 实时补充的行情
interface FavRow extends Favorite {
  last_close?: number | null;
  pct_chg?: number | null;
  last_date?: string | null;
  quoteFailed?: boolean;
}

const FavoritePanel: React.FC<FavoritePanelProps> = ({
  refreshKey,
  onLoadingChange,
  onOpenKline,
  onFavChange,
}) => {
  const [rows, setRows] = useState<FavRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    let base: Favorite[] = [];
    try {
      base = (await favoriteAPI.getList()) ?? [];
      setRows(base);
    } catch (err: any) {
      message.error(err?.message || '加载收藏列表失败');
      setRows([]);
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }
    setLoading(false);
    onLoadingChange?.(false);

    // 收藏接口只给 code/name/note，行情要逐只补。
    // 串行会很慢，但并发过高会打爆上游，这里限制到 4 条并发。
    const enriched: FavRow[] = [...base];
    const queue = [...base.keys()];
    const worker = async () => {
      while (queue.length) {
        const i = queue.shift()!;
        const r = base[i];
        try {
          const k = await astockAPI.getKline(r.code, { limit: 2 });
          const bars = (k?.bars ?? []).filter((b) => toNum(b.raw_close) !== null);
          const last = bars[bars.length - 1];
          const prev = bars[bars.length - 2];
          const lastClose = last ? toNum(last.raw_close) : null;
          const prevClose = prev ? toNum(prev.raw_close) : null;
          enriched[i] = {
            ...r,
            last_close: lastClose,
            last_date: last?.trade_date ?? null,
            pct_chg:
              lastClose !== null && prevClose !== null && prevClose !== 0
                ? ((lastClose - prevClose) / prevClose) * 100
                : null,
          };
        } catch {
          enriched[i] = { ...r, quoteFailed: true };
        }
        setRows([...enriched]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, base.length) }, worker));
  }, [onLoadingChange]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleRemove = async (code: string) => {
    try {
      await favoriteAPI.remove(code);
      setRows((prev) => prev.filter((r) => r.code !== code));
      onFavChange?.();
      message.success('已取消收藏');
    } catch (err: any) {
      message.error(err?.message || '取消收藏失败');
    }
  };

  const saveNote = async (code: string) => {
    const note = draftNote;
    setEditing(null);
    try {
      await favoriteAPI.updateNote(code, note);
      setRows((prev) => prev.map((r) => (r.code === code ? { ...r, note } : r)));
    } catch (err: any) {
      message.error(err?.message || '保存备注失败');
    }
  };

  const filtered = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (r) =>
        r.code?.toLowerCase().includes(kw) ||
        r.name?.toLowerCase().includes(kw) ||
        r.note?.toLowerCase().includes(kw)
    );
  }, [rows, keyword]);

  const columns: ColumnsType<FavRow> = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 104,
      render: (code: string, row) => (
        <a className={styles.codeLink} onClick={() => onOpenKline({ code, name: row.name ?? undefined })}>
          {code}
        </a>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name: string | null, row) => (
        <Tooltip title="收藏时的名称快照，股票改名后可能与最新名称不同">
          <a className={styles.nameLink} onClick={() => onOpenKline({ code: row.code, name: name ?? undefined })}>
            {name || '—'}
          </a>
        </Tooltip>
      ),
    },
    {
      title: '最新价',
      dataIndex: 'last_close',
      key: 'last_close',
      width: 96,
      align: 'right',
      sorter: (a, b) => (a.last_close ?? 0) - (b.last_close ?? 0),
      render: (v: number | null, row) =>
        row.quoteFailed ? (
          <Tooltip title="行情加载失败"><span className={styles.muted}>—</span></Tooltip>
        ) : (
          fmtNum(v ?? null)
        ),
    },
    {
      title: '涨跌幅',
      dataIndex: 'pct_chg',
      key: 'pct_chg',
      width: 96,
      align: 'right',
      sorter: (a, b) => (a.pct_chg ?? 0) - (b.pct_chg ?? 0),
      render: (v: number | null) => <span className={retClass(v ?? null)}>{fmtPct(v ?? null)}</span>,
    },
    {
      title: '数据日',
      dataIndex: 'last_date',
      key: 'last_date',
      width: 106,
      render: (d: string | null) => <span className={styles.muted}>{d || '—'}</span>,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (note: string | null, row) =>
        editing === row.code ? (
          <Input
            size="small"
            autoFocus
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onPressEnter={() => saveNote(row.code)}
            onBlur={() => saveNote(row.code)}
            placeholder="回车保存"
          />
        ) : (
          <span
            className={styles.noteCell}
            onClick={() => { setEditing(row.code); setDraftNote(note ?? ''); }}
            title="点击编辑备注"
          >
            {note || <span className={styles.notePlaceholder}>点击添加备注</span>}
          </span>
        ),
    },
    {
      title: '收藏时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: (a, b) => (a.created_at < b.created_at ? -1 : 1),
      render: (t: string) => <span className={styles.muted}>{t?.replace('T', ' ').slice(0, 16) || '—'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, row) => (
        <Popconfirm title={`取消收藏 ${row.name || row.code}？`} onConfirm={() => handleRemove(row.code)} okText="取消收藏" cancelText="算了">
          <a className={styles.removeLink}>移除</a>
        </Popconfirm>
      ),
    },
  ];

  return (
    <DataSection
      className={styles.section}
      title="我的收藏"
      subtitle={keyword.trim() ? `${filtered.length} / ${rows.length} 只` : `${rows.length} 只`}
      headerActions={
        <div className={styles.filters}>
          <Input.Search
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索代码/名称/备注"
            allowClear
            size="small"
            style={{ width: 180 }}
          />
        </div>
      }
    >
      <Table<FavRow>
        rowKey="code"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        size="middle"
        pagination={{ pageSize: 30, showSizeChanger: false, showTotal: (t) => `共 ${t} 只` }}
        scroll={{ x: 920 }}
        locale={{
          emptyText: (
            <Empty
              description={
                keyword.trim()
                  ? `未匹配到「${keyword.trim()}」`
                  : '还没有收藏，在其他池子里点击代码前的 ☆ 即可添加'
              }
            />
          ),
        }}
      />
    </DataSection>
  );
};

export default FavoritePanel;
