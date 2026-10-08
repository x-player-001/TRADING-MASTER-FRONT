import React from 'react';
import styles from './Header.module.scss';

interface HeaderProps {
  isDark: boolean;
  onThemeToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDark, onThemeToggle }) => {

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <a href="#" className={styles.brand}>
          <div className={styles.logo}>TM</div>
          <span className={styles.title}>Trading Master</span>
        </a>

        <div className={styles.rightSection}>
          <div className={styles.statusIndicator}>
            <span>在线</span>
          </div>

          <button
            className={styles.themeToggle}
            onClick={onThemeToggle}
            title={isDark ? '切换到浅色模式' : '切换到深色模式'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;