import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket.tsx';

const navItems = [
  { to: '/', label: 'Overview', icon: '~' },
  { to: '/tasks', label: 'Tasks', icon: '#' },
  { to: '/memory', label: 'Memory', icon: '*' },
  { to: '/agents', label: 'Agents', icon: '>' },
  { to: '/settings', label: 'Settings', icon: '%' },
];

export function Sidebar() {
  const { connected } = useWebSocket();

  return (
    <aside className="w-56 bg-surface-1 border-r border-surface-3 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-surface-3">
        <h1 className="text-lg font-bold text-gray-100">Agent Dashboard</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger animate-pulse'}`} />
          <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 mb-0.5 ${
                isActive
                  ? 'bg-accent/10 text-accent-hover font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-2'
              }`
            }
          >
            <span className="w-5 text-center font-mono">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-surface-3 text-xs text-gray-600">
        v0.1.0
      </div>
    </aside>
  );
}
