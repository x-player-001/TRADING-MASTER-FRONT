import React from 'react';
import styles from './StatusCard.module.scss';

export interface StatusIndicatorProps {
  status: 'running' | 'stopped' | 'healthy' | 'warning' | 'unhealthy' | 'unknown';
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, className = '' }) => {
  return (
    <div className={`${styles.statusIndicator} ${styles[status]} ${className}`}></div>
  );
};

export default StatusIndicator;