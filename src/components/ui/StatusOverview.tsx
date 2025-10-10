import React from 'react';
import StatusCard, { StatusCardProps } from './StatusCard';
import styles from './StatusOverview.module.scss';

export interface StatusOverviewProps {
  cards: StatusCardProps[];
  className?: string;
}

const StatusOverview: React.FC<StatusOverviewProps> = ({ cards, className = '' }) => {
  return (
    <div className={`${styles.overviewGrid} ${className}`}>
      {cards.map((card, index) => (
        <StatusCard
          key={index}
          {...card}
          index={card.index ?? index}
        />
      ))}
    </div>
  );
};

export default StatusOverview;