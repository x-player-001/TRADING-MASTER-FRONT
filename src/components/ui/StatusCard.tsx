import React, { ReactNode } from 'react';
import styles from './StatusCard.module.scss';

export interface StatusCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  status?: 'running' | 'stopped' | 'healthy' | 'warning' | 'unhealthy' | 'unknown';
  index?: number;
  className?: string;
  onClick?: () => void;
  glowColor?: string; // 自定义流光颜色
}

const StatusCard: React.FC<StatusCardProps> = ({
  icon,
  label,
  value,
  status,
  index = 0,
  className = '',
  onClick,
  glowColor
}) => {
  const getStatusClass = () => {
    if (!status) return '';
    switch (status) {
      case 'running':
      case 'healthy':
        return styles.running;
      case 'stopped':
      case 'unhealthy':
        return styles.stopped;
      case 'warning':
        return styles.warning;
      default:
        return '';
    }
  };

  const renderIcon = () => {
    if (typeof icon === 'string') {
      return <div className={styles.cardIcon}>{icon}</div>;
    }

    if (React.isValidElement(icon)) {
      return <div className={styles.cardIcon}>{icon}</div>;
    }

    return <div className={styles.cardIcon}>{icon}</div>;
  };

  const renderValue = () => {
    if (typeof value === 'string' || typeof value === 'number') {
      return (
        <div className={`${styles.value} ${getStatusClass()}`}>
          {value}
        </div>
      );
    }

    return value;
  };

  return (
    <div
      className={`${styles.statusCard} ${className}`}
      style={{
        '--index': index,
        '--glow-color': glowColor || 'rgba(59, 130, 246, 0.6)'
      } as React.CSSProperties}
      onClick={onClick}
    >
      {renderIcon()}
      <div className={styles.cardContent}>
        <div className={styles.label}>{label}</div>
        {renderValue()}
      </div>
    </div>
  );
};

export default StatusCard;