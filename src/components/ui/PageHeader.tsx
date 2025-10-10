import React from 'react';
import styles from './PageHeader.module.scss';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, children }) => {
  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        {icon && <div className={styles.icon}>{icon}</div>}
        <h1>{title}</h1>
        {children}
      </div>
      <p>{subtitle}</p>
    </div>
  );
};

export default PageHeader;