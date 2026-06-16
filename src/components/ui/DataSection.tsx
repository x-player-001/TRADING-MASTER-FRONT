import React, { ReactNode, useState } from 'react';
import styles from './DataSection.module.scss';

interface DataSectionProps {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  emptyIcon?: ReactNode;
  headerActions?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 默认是否折叠 */
  defaultCollapsed?: boolean;
}

/**
 * 通用数据区域组件
 * 处理加载、错误、空状态的显示
 */
export const DataSection: React.FC<DataSectionProps> = ({
  title,
  subtitle,
  loading = false,
  error = null,
  empty = false,
  emptyText = '暂无数据',
  emptyIcon = '📊',
  headerActions,
  children,
  className = '',
  compact = false,
  collapsible = false,
  defaultCollapsed = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const renderContent = () => {
    // 错误状态
    if (error) {
      return (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>⚠️</div>
          <p className={styles.errorText}>{error}</p>
        </div>
      );
    }

    // 加载状态
    if (loading) {
      return (
        <div className={styles.loadingState}>
          <div className={styles.spinner}>
            <div className={styles.spinnerInner}></div>
          </div>
          <p className={styles.loadingText}>数据加载中...</p>
        </div>
      );
    }

    // 空状态
    if (empty) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{emptyIcon}</div>
          <p className={styles.emptyText}>{emptyText}</p>
        </div>
      );
    }

    // 正常内容
    return children;
  };

  const handleToggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className={`${styles.dataSection} ${compact ? styles.compact : ''} ${isCollapsed ? styles.collapsed : ''} ${className}`}>
      {/* 标题区域 */}
      {(title || headerActions) && (
        <div
          className={`${styles.header} ${compact ? styles.headerCompact : ''} ${collapsible ? styles.headerClickable : ''}`}
          onClick={collapsible ? handleToggleCollapse : undefined}
        >
          <div className={`${styles.titleArea} ${compact ? styles.titleAreaCompact : ''}`}>
            {title && (
              <h2 className={`${styles.title} ${compact ? styles.titleCompact : ''}`}>
                {collapsible && (
                  <span className={`${styles.collapseIcon} ${isCollapsed ? styles.collapseIconCollapsed : ''}`}>
                    ▼
                  </span>
                )}
                {title}
              </h2>
            )}
            {subtitle && <span className={`${compact ? styles.subtitleCompact : styles.subtitle}`}>{compact ? ` · ${subtitle}` : subtitle}</span>}
          </div>
          {headerActions && (
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* 内容区域 */}
      <div className={`${styles.content} ${isCollapsed ? styles.contentCollapsed : ''}`}>
        {!isCollapsed && renderContent()}
      </div>
    </div>
  );
};

export default DataSection;