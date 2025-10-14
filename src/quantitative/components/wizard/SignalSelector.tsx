/**
 * 信号选择器 - 内联展开版本
 */

import React, { useState, useMemo } from 'react';
import { Input, Select, Button, Tag, Empty } from 'antd';
import { SearchOutlined, CloseOutlined } from '@ant-design/icons';
import styles from './SignalSelector.module.scss';

interface SignalSelectorProps {
  onSelect: (signalName: string) => void;
  onClose: () => void;
}

// 模拟信号数据（实际应该从API获取）
// 注意：信号名称必须是7段格式 k1_k2_k3_v1_v2_v3_score
const mockSignals = [
  { name: '15m_D0BL9_V230228_向上_任意_任意_任意_0', display_name: '笔方向向上', freq: '15m', category: '笔相关' },
  { name: '15m_D0BL9_V230228_向下_任意_任意_任意_0', display_name: '笔方向向下', freq: '15m', category: '笔相关' },
  { name: '15m_D1BS_一买_任意_任意_任意_0', display_name: '缠论一买', freq: '15m', category: '买卖点' },
  { name: '15m_D1SS_一卖_任意_任意_任意_0', display_name: '缠论一卖', freq: '15m', category: '买卖点' },
  { name: '15m_D2BS_二买_任意_任意_任意_0', display_name: '缠论二买', freq: '15m', category: '买卖点' },
  { name: '15m_D2SS_二卖_任意_任意_任意_0', display_name: '缠论二卖', freq: '15m', category: '买卖点' },
  { name: '15m_D3BS_三买_任意_任意_任意_0', display_name: '缠论三买', freq: '15m', category: '买卖点' },
  { name: '15m_D3SS_三卖_任意_任意_任意_0', display_name: '缠论三卖', freq: '15m', category: '买卖点' },
  { name: '15m_MACD_金叉_任意_任意_任意_0', display_name: 'MACD金叉', freq: '15m', category: 'MACD' },
  { name: '15m_MACD_死叉_任意_任意_任意_0', display_name: 'MACD死叉', freq: '15m', category: 'MACD' },
  { name: '15m_VOL_放量_任意_任意_任意_0', display_name: '成交量放量', freq: '15m', category: '成交量' },
  { name: '15m_VOL_缩量_任意_任意_任意_0', display_name: '成交量缩量', freq: '15m', category: '成交量' },
  { name: '1h_D0BL9_V230228_向上_任意_任意_任意_0', display_name: '笔方向向上', freq: '1h', category: '笔相关' },
  { name: '1h_D0BL9_V230228_向下_任意_任意_任意_0', display_name: '笔方向向下', freq: '1h', category: '笔相关' },
  { name: '1h_D1BS_一买_任意_任意_任意_0', display_name: '缠论一买', freq: '1h', category: '买卖点' },
  { name: '1h_D1SS_一卖_任意_任意_任意_0', display_name: '缠论一卖', freq: '1h', category: '买卖点' },
];

const SignalSelector: React.FC<SignalSelectorProps> = ({ onSelect, onClose }) => {
  const [searchText, setSearchText] = useState('');
  const [filterFreq, setFilterFreq] = useState<string | undefined>();
  const [filterCategory, setFilterCategory] = useState<string | undefined>();

  // 筛选后的信号列表
  const filteredSignals = useMemo(() => {
    return mockSignals.filter(signal => {
      // 搜索过滤
      if (searchText) {
        const lowerSearch = searchText.toLowerCase();
        if (
          !signal.name.toLowerCase().includes(lowerSearch) &&
          !signal.display_name.toLowerCase().includes(lowerSearch)
        ) {
          return false;
        }
      }

      // 周期过滤
      if (filterFreq && signal.freq !== filterFreq) {
        return false;
      }

      // 分类过滤
      if (filterCategory && signal.category !== filterCategory) {
        return false;
      }

      return true;
    });
  }, [searchText, filterFreq, filterCategory]);

  // 获取所有周期
  const allFreqs = useMemo(() => {
    return Array.from(new Set(mockSignals.map(s => s.freq)));
  }, []);

  // 获取所有分类
  const allCategories = useMemo(() => {
    return Array.from(new Set(mockSignals.map(s => s.category)));
  }, []);

  return (
    <div className={styles.signalSelector}>
      {/* 头部 */}
      <div className={styles.header}>
        <span className={styles.title}>选择信号</span>
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </div>

      {/* 搜索和过滤 */}
      <div className={styles.filters}>
        <Input
          placeholder="搜索信号名称..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />

        <Select
          placeholder="周期"
          value={filterFreq}
          onChange={setFilterFreq}
          allowClear
          style={{ width: 120 }}
          options={allFreqs.map(freq => ({ label: freq, value: freq }))}
        />

        <Select
          placeholder="分类"
          value={filterCategory}
          onChange={setFilterCategory}
          allowClear
          style={{ width: 120 }}
          options={allCategories.map(cat => ({ label: cat, value: cat }))}
        />
      </div>

      {/* 信号列表 */}
      <div className={styles.signalList}>
        {filteredSignals.length === 0 ? (
          <Empty
            description="没有找到匹配的信号"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          filteredSignals.map((signal, index) => (
            <div
              key={index}
              className={styles.signalItem}
              onClick={() => onSelect(signal.name)}
            >
              <div className={styles.signalMain}>
                <span className={styles.displayName}>{signal.display_name}</span>
                <div className={styles.tags}>
                  <Tag color="blue">{signal.freq}</Tag>
                  <Tag>{signal.category}</Tag>
                </div>
              </div>
              <div className={styles.signalName}>{signal.name}</div>
            </div>
          ))
        )}
      </div>

      {/* 底部提示 */}
      <div className={styles.footer}>
        <span className={styles.count}>共 {filteredSignals.length} 个信号</span>
        <span className={styles.hint}>💡 点击信号即可添加</span>
      </div>
    </div>
  );
};

export default SignalSelector;
