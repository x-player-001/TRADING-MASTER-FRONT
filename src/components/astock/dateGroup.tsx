import type { ColumnsType } from 'antd/es/table';
import styles from '../../pages/WatchPool.module.scss';

// ===== 监控池三个池子共用的「按日期分组」 =====
// 三个池子的表格结构一致（antd Table + 扁平 dataSource），这里用一条
// 跨列的分隔行把同一天的票归到一起，而不是各写一套分组表格。
//   首板池 / 放量池 -> trigger_date
//   回踩池          -> pullback_date

// 分组头行：混进 dataSource，用 __groupDate 标记
export interface GroupHeaderRow {
  __groupDate: string;
  __count: number;
}

export type WithGroupHeader<T> = T | GroupHeaderRow;

export const isGroupHeader = (r: unknown): r is GroupHeaderRow =>
  !!r && typeof r === 'object' && '__groupDate' in (r as object);

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// "2026-09-11" -> "09-11 周五"（避免时区问题，不走 Date 解析字符串的隐式行为）
const formatGroupDate = (d: string): string => {
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  const w = new Date(y, m - 1, day).getDay();
  return `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')} 周${WEEKDAYS[w]}`;
};

/**
 * 按日期把列表切成若干组，并在每组前插入一行分组头。
 * 日期倒序（最近的在最上面），组内保持接口返回的原始顺序（即当前排序字段）。
 */
export function groupByDate<T extends Record<string, any>>(
  rows: T[],
  dateKey: keyof T & string
): WithGroupHeader<T>[] {
  if (!rows.length) return [];

  const buckets = new Map<string, T[]>();
  for (const r of rows) {
    // 日期缺失时归入「未知日期」，不能让它们悄悄混进某一天
    const k = (r[dateKey] as string) || '未知日期';
    const arr = buckets.get(k);
    if (arr) arr.push(r);
    else buckets.set(k, [r]);
  }

  const dates = [...buckets.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const out: WithGroupHeader<T>[] = [];
  for (const d of dates) {
    const items = buckets.get(d)!;
    out.push({ __groupDate: d, __count: items.length });
    out.push(...items);
  }
  return out;
}

/**
 * 把普通列定义包装成支持分组头的列定义：
 * 第一列在分组头行渲染「日期 + 条数」并横跨整表，其余列在该行不渲染。
 */
export function withGroupHeaderColumns<T extends Record<string, any>>(
  columns: ColumnsType<T>,
  dateLabel: string
): ColumnsType<WithGroupHeader<T>> {
  const total = columns.length;
  return columns.map((col, idx) => ({
    ...(col as any),
    onCell: (record: WithGroupHeader<T>, rowIndex?: number) => {
      if (isGroupHeader(record)) {
        // 首列跨全表，其余列收起（colSpan 0 = 不渲染该单元格）
        return idx === 0
          ? { colSpan: total, className: styles.groupHeaderCell }
          : { colSpan: 0 };
      }
      const orig = (col as any).onCell;
      return orig ? orig(record as T, rowIndex) : {};
    },
    render: (value: any, record: WithGroupHeader<T>, index: number) => {
      if (isGroupHeader(record)) {
        if (idx !== 0) return null;
        return (
          <span className={styles.groupHeader}>
            <span className={styles.groupHeaderDate}>{formatGroupDate(record.__groupDate)}</span>
            <span className={styles.groupHeaderLabel}>{dateLabel}</span>
            <span className={styles.groupHeaderCount}>{record.__count} 只</span>
          </span>
        );
      }
      const orig = (col as any).render;
      return orig ? orig(value, record as T, index) : value;
    },
  })) as ColumnsType<WithGroupHeader<T>>;
}

/** 分组头行不参与常规行样式（例如破位置灰） */
export function groupRowClassName<T extends Record<string, any>>(
  base: (row: T) => string
): (row: WithGroupHeader<T>) => string {
  return (row) => (isGroupHeader(row) ? styles.groupHeaderRow : base(row as T));
}
