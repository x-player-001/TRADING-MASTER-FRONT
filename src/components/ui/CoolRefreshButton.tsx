import React, { useState, useCallback } from 'react';
import styles from './CoolRefreshButton.module.scss';

interface CoolRefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  iconOnly?: boolean; // 只显示图标，不显示文字
}

const CoolRefreshButton: React.FC<CoolRefreshButtonProps> = ({
  onClick,
  loading = false,
  disabled = false,
  size = 'medium',
  iconOnly = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (!disabled && !loading) {
      setIsHovered(true);
    }
  }, [disabled, loading]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
  }, []);

  const handleMouseDown = useCallback(() => {
    if (!disabled && !loading) {
      setIsPressed(true);
    }
  }, [disabled, loading]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled && !loading) {
      onClick();
    }
  }, [disabled, loading, onClick]);

  const buttonClass = [
    styles.coolRefreshButton,
    styles[size],
    iconOnly && styles.iconOnly,
    isHovered && styles.hovered,
    isPressed && styles.pressed,
    loading && styles.loading,
    disabled && styles.disabled
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClass}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      disabled={disabled || loading}
      title="刷新数据"
      aria-label="刷新数据"
    >
      <div className={styles.iconContainer}>
        <div className={styles.icon}>
          {loading ? (
            <div className={styles.spinner}>
              <div className={styles.spinnerInner}></div>
            </div>
          ) : (
            <svg
              className={styles.refreshIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          )}
        </div>
        <div className={styles.ripple}></div>
      </div>
      {!iconOnly && <span className={styles.label}>刷新</span>}
    </button>
  );
};

export default CoolRefreshButton;