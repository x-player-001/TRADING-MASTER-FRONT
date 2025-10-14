/**
 * Position配置器 - 核心组件
 */

import React, { useState } from 'react';
import { Button, Card, InputNumber, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import type { CZSCPositionConfig } from '../../types/strategy';
import OperationEditor from './OperationEditor';
import styles from './PositionEditor.module.scss';

interface PositionEditorProps {
  positions: CZSCPositionConfig[];
  onChange: (positions: CZSCPositionConfig[]) => void;
}

const PositionEditor: React.FC<PositionEditorProps> = ({ positions, onChange }) => {
  // 每个Position的展开状态
  const [expandedPositions, setExpandedPositions] = useState<Set<number>>(
    new Set(positions.length > 0 ? [0] : [])
  );

  // 切换Position展开
  const togglePosition = (index: number) => {
    setExpandedPositions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 添加Position
  const handleAddPosition = () => {
    const newPosition: CZSCPositionConfig = {
      name: `Position ${positions.length + 1}`,
      opens: [],
      exits: [],
      interval: 10,
      timeout: 100,
      stop_loss: 200,
      T0: false
    };

    onChange([...positions, newPosition]);
    setExpandedPositions(new Set([positions.length])); // 展开新Position
  };

  // 删除Position
  const handleDeletePosition = (index: number) => {
    const updated = positions.filter((_, i) => i !== index);
    onChange(updated);

    // 清理展开状态
    setExpandedPositions(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  // 更新Position
  const handleUpdatePosition = (index: number, updates: Partial<CZSCPositionConfig>) => {
    const updated = [...positions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  return (
    <div className={styles.positionEditor}>
      {positions.length === 0 ? (
        <div className={styles.empty}>
          <p>还没有配置Position</p>
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddPosition}>
            添加第一个Position
          </Button>
        </div>
      ) : (
        <div className={styles.positionList}>
          {positions.map((position, index) => {
            const isExpanded = expandedPositions.has(index);

            return (
              <Card
                key={index}
                className={`${styles.positionCard} ${isExpanded ? styles.expanded : ''}`}
              >
                {/* Position 头部 */}
                <div className={styles.positionHeader}>
                  <div className={styles.left}>
                    <span className={styles.index}>Position {index + 1}</span>
                    <input
                      className={styles.nameInput}
                      value={position.name}
                      onChange={(e) => handleUpdatePosition(index, { name: e.target.value })}
                      placeholder="Position名称"
                    />
                  </div>

                  <div className={styles.right}>
                    <Button
                      size="small"
                      icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                      onClick={() => togglePosition(index)}
                    >
                      {isExpanded ? '折叠' : '展开'}
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeletePosition(index)}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                {/* Position 内容 */}
                {isExpanded && (
                  <div className={styles.positionContent}>
                    {/* 开仓条件 */}
                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span className={styles.title}>🟢 开仓条件 (Opens)</span>
                        <span className={styles.count}>{position.opens.length}个操作</span>
                      </div>
                      <OperationEditor
                        operations={position.opens}
                        operationType="opens"
                        onChange={(opens) => handleUpdatePosition(index, { opens })}
                      />
                    </div>

                    {/* 平仓条件 */}
                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span className={styles.title}>🔴 平仓条件 (Exits)</span>
                        <span className={styles.count}>{position.exits.length}个操作</span>
                      </div>
                      <OperationEditor
                        operations={position.exits}
                        operationType="exits"
                        onChange={(exits) => handleUpdatePosition(index, { exits })}
                      />
                    </div>

                    {/* 风控参数 */}
                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span className={styles.title}>⚙️ 风控参数</span>
                      </div>
                      <div className={styles.riskParams}>
                        <div className={styles.param}>
                          <label>开仓间隔 (K线数):</label>
                          <InputNumber
                            value={position.interval}
                            onChange={(val) => handleUpdatePosition(index, { interval: val || 0 })}
                            min={0}
                            max={100}
                          />
                          <span className={styles.hint}>0表示无限制</span>
                        </div>

                        <div className={styles.param}>
                          <label>超时平仓 (K线数):</label>
                          <InputNumber
                            value={position.timeout}
                            onChange={(val) => handleUpdatePosition(index, { timeout: val || 100 })}
                            min={10}
                            max={500}
                          />
                        </div>

                        <div className={styles.param}>
                          <label>止损 (BP):</label>
                          <InputNumber
                            value={position.stop_loss}
                            onChange={(val) => handleUpdatePosition(index, { stop_loss: val || 200 })}
                            min={50}
                            max={1000}
                          />
                          <span className={styles.hint}>1BP=0.01%, 200表示2%</span>
                        </div>

                        <div className={styles.param}>
                          <Checkbox
                            checked={position.T0}
                            onChange={(e) => handleUpdatePosition(index, { T0: e.target.checked })}
                          >
                            启用T+0交易
                          </Checkbox>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* 添加Position按钮 */}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={handleAddPosition}
            className={styles.addButton}
          >
            添加Position
          </Button>
        </div>
      )}
    </div>
  );
};

export default PositionEditor;
