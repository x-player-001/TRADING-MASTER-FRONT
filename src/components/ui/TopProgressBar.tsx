import React, { useEffect, useState } from 'react';
import styles from './TopProgressBar.module.scss';

interface TopProgressBarProps {
  isVisible: boolean;
  progress?: number; // 0-100，如果不传则使用模拟进度
  duration?: number; // 自动进度的持续时间(ms)
  relative?: boolean; // 是否使用相对定位而不是固定定位
  absolute?: boolean; // 是否使用绝对定位（相对于父容器）
}

/**
 * 顶部进度条组件
 * 支持自动进度和手动控制进度
 */
export const TopProgressBar: React.FC<TopProgressBarProps> = ({
  isVisible,
  progress,
  duration = 2000,
  relative = false,
  absolute = false
}) => {
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      setCurrentProgress(0);

      if (progress !== undefined) {
        // 手动控制进度
        setCurrentProgress(progress);
      } else {
        // 自动进度动画
        const timer = setTimeout(() => {
          setCurrentProgress(85); // 快速到85%
        }, 100);

        return () => clearTimeout(timer);
      }
    } else {
      // 隐藏时快速完成到100%然后淡出
      if (currentProgress > 0) {
        setCurrentProgress(100);
        const hideTimer = setTimeout(() => {
          setIsAnimating(false);
          setCurrentProgress(0);
        }, 300);
        return () => clearTimeout(hideTimer);
      }
    }
  }, [isVisible, progress]);

  if (!isAnimating && !isVisible) {
    return null;
  }

  return (
    <div
      className={`${styles.progressContainer} ${
        isVisible ? styles.visible : styles.hidden
      } ${relative ? styles.relative : ''} ${absolute ? styles.absolute : ''}`}
    >
      <div
        className={styles.progressBar}
        style={{
          width: `${currentProgress}%`,
          transition: currentProgress === 100
            ? 'width 0.3s ease-out, opacity 0.3s ease-out 0.1s'
            : 'width 0.5s ease-out'
        }}
      />
    </div>
  );
};

export default TopProgressBar;