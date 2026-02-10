import React from 'react';

const statusColors: Record<string, string> = {
  // Agent statuses
  idle: 'bg-gray-500/20 text-gray-400',
  busy: 'bg-accent/20 text-accent-hover',
  error: 'bg-danger/20 text-danger',
  offline: 'bg-gray-700/20 text-gray-600',
  // Task statuses
  created: 'bg-gray-500/20 text-gray-400',
  queued: 'bg-info/20 text-info',
  assigned: 'bg-accent/20 text-accent-hover',
  running: 'bg-warning/20 text-warning',
  review: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-success/20 text-success',
  failed: 'bg-danger/20 text-danger',
  rejected: 'bg-red-500/20 text-red-400',
};

const statusDots: Record<string, string> = {
  idle: 'bg-gray-400',
  busy: 'bg-accent animate-pulse',
  error: 'bg-danger',
  offline: 'bg-gray-600',
  running: 'bg-warning animate-pulse',
  review: 'bg-purple-400 animate-pulse',
  completed: 'bg-success',
  failed: 'bg-danger',
};

export function StatusBadge({ status }: { status: string }) {
  const colorClass = statusColors[status] || 'bg-gray-500/20 text-gray-400';
  const dotClass = statusDots[status];

  return (
    <span className={`badge ${colorClass}`}>
      {dotClass && <span className={`w-1.5 h-1.5 rounded-full ${dotClass} mr-1.5`} />}
      {status}
    </span>
  );
}
