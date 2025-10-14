/**
 * 策略创建向导 - 手风琴式折叠主容器
 */

import React, { useState } from 'react';
import { Collapse, Button, message } from 'antd';
import type { CollapseProps } from 'antd';
import { strategyAPI } from '../services/strategyAPI';
import type { CZSCStrategyCreate } from '../types/strategy';
import type { StrategyWizardState, CollapseState } from '../types/strategyWizard';
import { initialWizardState } from '../types/strategyWizard';
import { strategyTemplates } from '../config/strategyTemplates';
import TemplateSelector from './wizard/TemplateSelector';
import BasicInfoForm from './wizard/BasicInfoForm';
import PositionEditor from './wizard/PositionEditor';
import SignalConfigEditor from './wizard/SignalConfigEditor';
import BacktestParamsForm from './wizard/BacktestParamsForm';
import styles from './CreateStrategyWizard.module.scss';

const { Panel } = Collapse;

interface CreateStrategyWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateStrategyWizard: React.FC<CreateStrategyWizardProps> = ({ onClose, onSuccess }) => {
  // 向导状态
  const [wizardState, setWizardState] = useState<StrategyWizardState>(initialWizardState);

  // 折叠面板状态
  const [activeKeys, setActiveKeys] = useState<string[]>(['template', 'basic']);

  // Position/Operation/Factor展开状态
  const [collapseState, setCollapseState] = useState<CollapseState>({
    expandedPositions: new Set([0]),
    expandedOperations: {},
    expandedFactors: {}
  });

  // 是否正在保存
  const [isSaving, setIsSaving] = useState(false);

  // 处理面板切换
  const handlePanelChange = (keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys]);
  };

  // 更新向导状态
  const updateWizardState = (updates: Partial<StrategyWizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  };

  // 处理模板选择
  const handleTemplateSelect = (templateKey: string) => {
    const template = strategyTemplates[templateKey];
    if (!template) return;

    // 更新状态
    setWizardState(prev => ({
      ...prev,
      selectedTemplate: templateKey,
      metadata: {
        ...prev.metadata,
        name: template.name,
        description: template.description,
        category: template.category
      },
      positions: JSON.parse(JSON.stringify(template.positions_config)), // 深拷贝
      signals: JSON.parse(JSON.stringify(template.signals_config))
    }));

    // 自动展开后续面板
    setActiveKeys(['template', 'basic', 'positions', 'signals']);

    message.success(`已加载模板：${template.name}`);
  };

  // 更新基本信息
  const handleMetadataChange = (updates: Partial<StrategyWizardState['metadata']>) => {
    setWizardState(prev => ({
      ...prev,
      metadata: { ...prev.metadata, ...updates }
    }));
  };

  // 保存策略
  const handleSave = async () => {
    try {
      // 验证配置
      if (!wizardState.metadata.name) {
        message.error('请输入策略名称');
        return;
      }

      if (wizardState.positions.length === 0) {
        message.error('请至少配置一个Position');
        return;
      }

      if (wizardState.signals.length === 0) {
        message.error('请至少配置一个信号函数');
        return;
      }

      setIsSaving(true);

      // 构造创建请求
      const createData: CZSCStrategyCreate = {
        strategy_id: `strategy_${Date.now()}`,
        name: wizardState.metadata.name,
        description: wizardState.metadata.description,
        category: wizardState.metadata.category,
        positions_config: wizardState.positions,
        signals_config: wizardState.signals,
        ensemble_method: wizardState.backtestParams.ensemble_method,
        fee_rate: wizardState.backtestParams.fee_rate,
        digits: wizardState.backtestParams.digits,
        version: wizardState.metadata.version,
        author: wizardState.metadata.author,
        tags: wizardState.metadata.tags
      };

      await strategyAPI.createStrategy(createData);
      message.success('策略创建成功！');
      onSuccess();
    } catch (error: any) {
      message.error(error.message || '创建失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 验证配置状态
  const getValidationStatus = () => {
    const errors: string[] = [];

    if (!wizardState.metadata.name) {
      errors.push('缺少策略名称');
    }

    if (wizardState.positions.length === 0) {
      errors.push('缺少Position配置');
    }

    if (wizardState.signals.length === 0) {
      errors.push('缺少Signal配置');
    }

    // TODO: 更详细的验证逻辑

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const validation = getValidationStatus();

  return (
    <div className={styles.wizardContainer}>
      {/* 顶部操作栏 */}
      <div className={styles.header}>
        <div className={styles.title}>创建策略</div>
        <div className={styles.actions}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            onClick={handleSave}
            loading={isSaving}
            disabled={!validation.isValid}
          >
            保存策略
          </Button>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className={styles.quickActions}>
        <span className={styles.label}>快捷操作:</span>
        <Button size="small" onClick={() => setActiveKeys(['template', 'basic', 'positions', 'signals', 'params', 'preview'])}>
          全部展开
        </Button>
        <Button size="small" onClick={() => setActiveKeys([])}>
          全部折叠
        </Button>
        {wizardState.selectedTemplate && (
          <span className={styles.templateInfo}>
            当前模板: {strategyTemplates[wizardState.selectedTemplate]?.name || '无'}
          </span>
        )}
      </div>

      {/* 验证状态 */}
      {!validation.isValid && (
        <div className={styles.validationWarning}>
          ⚠️ 配置未完成: {validation.errors.join(', ')}
        </div>
      )}

      {/* 主内容区 - 折叠面板 */}
      <div className={styles.content}>
        <Collapse
          activeKey={activeKeys}
          onChange={handlePanelChange}
          accordion={false}
        >
          {/* Panel 1: 选择模板 */}
          <Panel header="1️⃣ 选择模板" key="template">
            <TemplateSelector
              wizardState={wizardState}
              onTemplateSelect={handleTemplateSelect}
            />
          </Panel>

          {/* Panel 2: 基本信息 */}
          <Panel header="2️⃣ 基本信息" key="basic">
            <BasicInfoForm
              wizardState={wizardState}
              onChange={handleMetadataChange}
            />
          </Panel>

          {/* Panel 3: Position配置 */}
          <Panel
            header={
              <div className={styles.panelHeader}>
                <span>3️⃣ Position配置 ({wizardState.positions.length}个)</span>
                {wizardState.positions.length === 0 && (
                  <span className={styles.errorBadge}>⚠️ 必需</span>
                )}
              </div>
            }
            key="positions"
          >
            <PositionEditor
              positions={wizardState.positions}
              onChange={(positions) => updateWizardState({ positions })}
            />
          </Panel>

          {/* Panel 4: Signal配置 */}
          <Panel
            header={
              <div className={styles.panelHeader}>
                <span>4️⃣ Signal配置 ({wizardState.signals.length}个)</span>
                {wizardState.signals.length === 0 && (
                  <span className={styles.errorBadge}>⚠️ 必需</span>
                )}
              </div>
            }
            key="signals"
          >
            <SignalConfigEditor
              signals={wizardState.signals}
              onChange={(signals) => updateWizardState({ signals })}
            />
          </Panel>

          {/* Panel 5: 回测参数 */}
          <Panel header="5️⃣ 回测参数" key="params">
            <BacktestParamsForm
              wizardState={wizardState}
              onChange={(backtestParams) =>
                setWizardState(prev => ({
                  ...prev,
                  backtestParams: { ...prev.backtestParams, ...backtestParams }
                }))
              }
            />
          </Panel>

          {/* Panel 6: 预览JSON */}
          <Panel header="6️⃣ 预览 JSON" key="preview">
            <div className={styles.panelContent}>
              {/* TODO: JSON预览 */}
              <pre className={styles.jsonPreview}>
                {JSON.stringify(wizardState, null, 2)}
              </pre>
            </div>
          </Panel>
        </Collapse>
      </div>
    </div>
  );
};

export default CreateStrategyWizard;
