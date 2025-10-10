import React from 'react';
import styles from './SeverityFilter.module.scss';

interface SeverityFilterProps {
  value: 'all' | 'high' | 'medium' | 'low';
  onChange: (severity: 'all' | 'high' | 'medium' | 'low') => void;
  size?: 'small' | 'medium';
  disabled?: boolean;
}

interface SeverityOption {
  value: 'all' | 'high' | 'medium' | 'low';
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
}

const severityOptions: SeverityOption[] = [
  {
    value: 'all',
    label: '全部',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
    emoji: '🔍'
  },
  {
    value: 'low',
    label: '低',
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.1)',
    emoji: '🟢'
  },
  {
    value: 'medium',
    label: '中',
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.1)',
    emoji: '🟡'
  },
  {
    value: 'high',
    label: '高',
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.1)',
    emoji: '🔴'
  }
];

const SeverityFilter: React.FC<SeverityFilterProps> = ({
  value,
  onChange,
  size = 'medium',
  disabled = false
}) => {
  const handleOptionClick = (optionValue: 'all' | 'high' | 'medium' | 'low') => {
    if (!disabled && optionValue !== value) {
      onChange(optionValue);
    }
  };

  return (
    <div className={`${styles.severityFilter} ${styles[size]} ${disabled ? styles.disabled : ''}`}>
      {severityOptions.map((option) => (
        <button
          key={option.value}
          className={`${styles.option} ${value === option.value ? styles.active : ''}`}
          onClick={() => handleOptionClick(option.value)}
          disabled={disabled}
          title={`显示${option.label}严重程度的异常`}
          style={{
            '--option-color': option.color,
            '--option-bg-color': option.bgColor,
          } as React.CSSProperties}
        >
          <span className={styles.emoji}>{option.emoji}</span>
        </button>
      ))}
    </div>
  );
};

export default SeverityFilter;