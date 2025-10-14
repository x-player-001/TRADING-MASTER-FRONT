/**
 * 操作编辑器 - 管理 Opens/Exits 操作
 */

import React, { useState } from 'react';
import { Button, Select, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import type { CZSCOperation } from '../../types/strategy';
import FactorEditor from './FactorEditor';
import styles from './OperationEditor.module.scss';

interface OperationEditorProps {
  operations: CZSCOperation[];
  operationType: 'opens' | 'exits';
  onChange: (operations: CZSCOperation[]) => void;
}

const OperationEditor: React.FC<OperationEditorProps> = ({
  operations,
  operationType,
  onChange
}) => {
  // 展开状态
  const [expandedOperations, setExpandedOperations] = useState<Set<number>>(
    new Set(operations.length > 0 ? [0] : [])
  );

  // 操作类型选项
  const operateOptions = operationType === 'opens'
    ? [
        { label: 'LO - 开多仓', value: 'LO' },
        { label: 'SO - 开空仓', value: 'SO' }
      ]
    : [
        { label: 'LE - 平多仓', value: 'LE' },
        { label: 'SE - 平空仓', value: 'SE' }
      ];

  // 切换展开
  const toggleOperation = (index: number) => {
    setExpandedOperations(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 添加操作
  const handleAddOperation = () => {
    const defaultOperate = operationType === 'opens' ? 'LO' : 'LE';
    const newOperation: CZSCOperation = {
      operate: defaultOperate as any,
      factors: []
    };

    onChange([...operations, newOperation]);
    setExpandedOperations(new Set([operations.length]));
  };

  // 删除操作
  const handleDeleteOperation = (index: number) => {
    const updated = operations.filter((_, i) => i !== index);
    onChange(updated);

    setExpandedOperations(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  // 更新操作
  const handleUpdateOperation = (index: number, updates: Partial<CZSCOperation>) => {
    const updated = [...operations];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  return (
    <div className={styles.operationEditor}>
      {operations.length === 0 ? (
        <div className={styles.empty}>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddOperation}
          >
            添加{operationType === 'opens' ? '开仓' : '平仓'}操作
          </Button>
        </div>
      ) : (
        <div className={styles.operationList}>
          {operations.map((operation, index) => {
            const isExpanded = expandedOperations.has(index);

            return (
              <Card
                key={index}
                className={`${styles.operationCard} ${isExpanded ? styles.expanded : ''}`}
                size="small"
              >
                {/* 操作头部 */}
                <div className={styles.operationHeader}>
                  <div className={styles.left}>
                    <span className={styles.label}>操作 {index + 1}:</span>
                    <Select
                      value={operation.operate}
                      onChange={(value) => handleUpdateOperation(index, { operate: value })}
                      options={operateOptions}
                      style={{ width: 140 }}
                      size="small"
                    />
                    <span className={styles.factorCount}>
                      ({operation.factors.length} 个Factor)
                    </span>
                  </div>

                  <div className={styles.right}>
                    <Button
                      size="small"
                      type="text"
                      icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                      onClick={() => toggleOperation(index)}
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteOperation(index)}
                    />
                  </div>
                </div>

                {/* 操作内容 - Factor列表 */}
                {isExpanded && (
                  <div className={styles.operationContent}>
                    <FactorEditor
                      factors={operation.factors}
                      onChange={(factors) => handleUpdateOperation(index, { factors })}
                    />
                  </div>
                )}
              </Card>
            );
          })}

          {/* 添加操作按钮 */}
          <Button
            type="dashed"
            size="small"
            block
            icon={<PlusOutlined />}
            onClick={handleAddOperation}
            className={styles.addButton}
          >
            添加{operationType === 'opens' ? '开仓' : '平仓'}操作
          </Button>
        </div>
      )}

      <div className={styles.hint}>
        💡 任一操作触发即可{operationType === 'opens' ? '开仓' : '平仓'}，多个操作为"或"关系
      </div>
    </div>
  );
};

export default OperationEditor;
