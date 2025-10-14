/**
 * 策略模板选择器
 */

import React from 'react';
import { Card } from 'antd';
import { strategyTemplates } from '../../config/strategyTemplates';
import type { StrategyWizardState } from '../../types/strategyWizard';
import styles from './TemplateSelector.module.scss';

interface TemplateSelectorProps {
  wizardState: StrategyWizardState;
  onTemplateSelect: (templateKey: string) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  wizardState,
  onTemplateSelect
}) => {
  const templateKeys = Object.keys(strategyTemplates);

  return (
    <div className={styles.templateSelector}>
      <div className={styles.grid}>
        {templateKeys.map((key) => {
          const template = strategyTemplates[key];
          const isSelected = wizardState.selectedTemplate === key;

          return (
            <Card
              key={key}
              hoverable
              className={`${styles.templateCard} ${isSelected ? styles.selected : ''}`}
              onClick={() => onTemplateSelect(key)}
            >
              <div className={styles.icon}>{template.icon}</div>
              <div className={styles.name}>{template.name}</div>
              <div className={styles.description}>{template.description}</div>
              <div className={styles.info}>
                <span className={styles.badge}>{template.category}</span>
                <span className={styles.count}>
                  {template.positions_config.length} Position
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className={styles.hint}>
        💡 <strong>提示:</strong> 选择模板后，系统会自动填充Position和Signal配置，您可以在后续步骤中调整参数
      </div>
    </div>
  );
};

export default TemplateSelector;
