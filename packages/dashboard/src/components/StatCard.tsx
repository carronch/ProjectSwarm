import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}

export function StatCard({ label, value, subtext, color = 'text-gray-100' }: StatCardProps) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}
