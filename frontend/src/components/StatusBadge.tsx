import React from 'react';
import { StatusPill } from './StatusPill';
import type { Status } from '../types';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  return (
    <StatusPill
      status={status}
      size={size}
      showLabel={showLabel}
      className={className}
    />
  );
};
