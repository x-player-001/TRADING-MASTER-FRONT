/**
 * Factor编辑器 - 管理信号逻辑组合
 */

import React, { useState } from 'react';
import { Button, Card, Input, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, DownOutlined, UpOutlined, CloseOutlined } from '@ant-design/icons';
import type { CZSCFactor } from '../../types/strategy';
import SignalSelector from './SignalSelector';
import styles from './FactorEditor.module.scss';

interface FactorEditorProps {
  factors: CZSCFactor[];
  onChange: (factors: CZSCFactor[]) => void;
}

const FactorEditor: React.FC<FactorEditorProps> = ({ factors, onChange }) => {
  // 展开状态
  const [expandedFactors, setExpandedFactors] = useState<Set<number>>(
    new Set(factors.length > 0 ? [0] : [])
  );

  // 信号选择器状态
  const [signalSelectorState, setSignalSelectorState] = useState<{
    factorIndex: number;
    logicType: 'signals_all' | 'signals_any' | 'signals_not';
  } | null>(null);

  // 切换展开
  const toggleFactor = (index: number) => {
    setExpandedFactors(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 添加Factor
  const handleAddFactor = () => {
    const newFactor: CZSCFactor = {
      name: `Factor ${factors.length + 1}`,
      signals_all: [],
      signals_any: [],
      signals_not: []
    };

    onChange([...factors, newFactor]);
    setExpandedFactors(new Set([factors.length]));
  };

  // 删除Factor
  const handleDeleteFactor = (index: number) => {
    const updated = factors.filter((_, i) => i !== index);
    onChange(updated);

    setExpandedFactors(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  // 更新Factor
  const handleUpdateFactor = (index: number, updates: Partial<CZSCFactor>) => {
    const updated = [...factors];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  // 打开信号选择器
  const handleOpenSignalSelector = (factorIndex: number, logicType: 'signals_all' | 'signals_any' | 'signals_not') => {
    setSignalSelectorState({ factorIndex, logicType });
  };

  // 关闭信号选择器
  const handleCloseSignalSelector = () => {
    setSignalSelectorState(null);
  };

  // 添加信号
  const handleAddSignal = (signalName: string) => {
    if (!signalSelectorState) return;

    const { factorIndex, logicType } = signalSelectorState;
    const factor = factors[factorIndex];
    const currentSignals = factor[logicType] || [];

    // 避免重复
    if (!currentSignals.includes(signalName)) {
      handleUpdateFactor(factorIndex, {
        [logicType]: [...currentSignals, signalName]
      });
    }

    handleCloseSignalSelector();
  };

  // 删除信号
  const handleRemoveSignal = (
    factorIndex: number,
    logicType: 'signals_all' | 'signals_any' | 'signals_not',
    signalName: string
  ) => {
    const factor = factors[factorIndex];
    const currentSignals = factor[logicType] || [];

    handleUpdateFactor(factorIndex, {
      [logicType]: currentSignals.filter(s => s !== signalName)
    });
  };

  // 计算Factor摘要
  const getFactorSummary = (factor: CZSCFactor) => {
    const allCount = factor.signals_all?.length || 0;
    const anyCount = factor.signals_any?.length || 0;
    const notCount = factor.signals_not?.length || 0;

    const parts = [];
    if (allCount > 0) parts.push(`${allCount}个AND`);
    if (anyCount > 0) parts.push(`${anyCount}个OR`);
    if (notCount > 0) parts.push(`${notCount}个NOT`);

    return parts.length > 0 ? parts.join(', ') : '暂无信号';
  };

  return (
    <div className={styles.factorEditor}>
      {factors.length === 0 ? (
        <div className={styles.empty}>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddFactor}
          >
            添加Factor
          </Button>
          <div className={styles.hint}>
            Factor是信号的逻辑组合，任一Factor满足即可触发
          </div>
        </div>
      ) : (
        <div className={styles.factorList}>
          {factors.map((factor, index) => {
            const isExpanded = expandedFactors.has(index);
            const summary = getFactorSummary(factor);

            return (
              <Card
                key={index}
                className={`${styles.factorCard} ${isExpanded ? styles.expanded : ''}`}
                size="small"
              >
                {/* Factor头部 */}
                <div className={styles.factorHeader}>
                  <div className={styles.left}>
                    <span className={styles.label}>Factor {index + 1}:</span>
                    <Input
                      value={factor.name || ''}
                      onChange={(e) => handleUpdateFactor(index, { name: e.target.value })}
                      placeholder="Factor名称"
                      size="small"
                      style={{ width: 150 }}
                    />
                    {!isExpanded && (
                      <span className={styles.summary}>({summary})</span>
                    )}
                  </div>

                  <div className={styles.right}>
                    <Button
                      size="small"
                      type="text"
                      icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                      onClick={() => toggleFactor(index)}
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteFactor(index)}
                    />
                  </div>
                </div>

                {/* Factor内容 - 信号逻辑组 */}
                {isExpanded && (
                  <div className={styles.factorContent}>
                    {/* signals_all - AND逻辑 */}
                    <div className={styles.logicGroup}>
                      <div className={styles.logicHeader}>
                        <span className={styles.logicTitle}>
                          ✓ 必须同时满足 (AND)
                        </span>
                        <Button
                          size="small"
                          type="link"
                          icon={<PlusOutlined />}
                          onClick={() => handleOpenSignalSelector(index, 'signals_all')}
                        >
                          添加信号
                        </Button>
                      </div>
                      <div className={styles.signalList}>
                        {(factor.signals_all && factor.signals_all.length > 0) ? (
                          factor.signals_all.map((signal, sIndex) => (
                            <Tag
                              key={sIndex}
                              closable
                              onClose={() => handleRemoveSignal(index, 'signals_all', signal)}
                              className={styles.signalTag}
                            >
                              {signal}
                            </Tag>
                          ))
                        ) : (
                          <span className={styles.emptyHint}>暂无信号</span>
                        )}
                      </div>
                    </div>

                    {/* signals_any - OR逻辑 */}
                    <div className={styles.logicGroup}>
                      <div className={styles.logicHeader}>
                        <span className={styles.logicTitle}>
                          ○ 满足任一即可 (OR)
                        </span>
                        <Button
                          size="small"
                          type="link"
                          icon={<PlusOutlined />}
                          onClick={() => handleOpenSignalSelector(index, 'signals_any')}
                        >
                          添加信号
                        </Button>
                      </div>
                      <div className={styles.signalList}>
                        {(factor.signals_any && factor.signals_any.length > 0) ? (
                          factor.signals_any.map((signal, sIndex) => (
                            <Tag
                              key={sIndex}
                              closable
                              onClose={() => handleRemoveSignal(index, 'signals_any', signal)}
                              className={styles.signalTag}
                              color="orange"
                            >
                              {signal}
                            </Tag>
                          ))
                        ) : (
                          <span className={styles.emptyHint}>暂无信号</span>
                        )}
                      </div>
                    </div>

                    {/* signals_not - NOT逻辑 */}
                    <div className={styles.logicGroup}>
                      <div className={styles.logicHeader}>
                        <span className={styles.logicTitle}>
                          ✗ 不能出现 (NOT)
                        </span>
                        <Button
                          size="small"
                          type="link"
                          icon={<PlusOutlined />}
                          onClick={() => handleOpenSignalSelector(index, 'signals_not')}
                        >
                          添加信号
                        </Button>
                      </div>
                      <div className={styles.signalList}>
                        {(factor.signals_not && factor.signals_not.length > 0) ? (
                          factor.signals_not.map((signal, sIndex) => (
                            <Tag
                              key={sIndex}
                              closable
                              onClose={() => handleRemoveSignal(index, 'signals_not', signal)}
                              className={styles.signalTag}
                              color="red"
                            >
                              {signal}
                            </Tag>
                          ))
                        ) : (
                          <span className={styles.emptyHint}>暂无信号</span>
                        )}
                      </div>
                    </div>

                    {/* 信号选择器（内联展开） */}
                    {signalSelectorState && signalSelectorState.factorIndex === index && (
                      <div className={styles.signalSelectorContainer}>
                        <SignalSelector
                          onSelect={handleAddSignal}
                          onClose={handleCloseSignalSelector}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {/* 添加Factor按钮 */}
          <Button
            type="dashed"
            size="small"
            block
            icon={<PlusOutlined />}
            onClick={handleAddFactor}
            className={styles.addButton}
          >
            添加Factor
          </Button>
        </div>
      )}

      <div className={styles.hint}>
        💡 多个Factor之间是"或"关系，任一Factor满足即可触发
      </div>
    </div>
  );
};

export default FactorEditor;
