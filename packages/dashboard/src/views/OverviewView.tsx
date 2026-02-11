import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { StatCard } from '../components/StatCard.tsx';

export function OverviewView() {
  const { agents, tasks, recentLogs, stats } = useWebSocket();

  const pendingReview = tasks.filter(t => t.status === 'review');
  const runningTasks = tasks.filter(t => t.status === 'running');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={stats.totalTasks} />
        <StatCard label="Completed" value={stats.completedTasks} color="text-success" />
        <StatCard label="Failed" value={stats.failedTasks} color="text-danger" />
        <StatCard
          label="Cost Today"
          value={`$${stats.estimatedCostToday.toFixed(4)}`}
          subtext={`${stats.totalTokensToday.toLocaleString()} tokens`}
        />
      </div>

      {/* Pending Approvals */}
      {pendingReview.length > 0 && (
        <div className="card border-purple-500/30">
          <h3 className="text-sm font-semibold text-purple-400 mb-3">
            Pending Approval ({pendingReview.length})
          </h3>
          <div className="space-y-2">
            {pendingReview.map(task => (
              <div key={task.id} className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-gray-500">{task.assignedAgent}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs px-3 py-1">Approve</button>
                  <button className="btn-danger text-xs px-3 py-1">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Agents */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Agents</h3>
          {agents.length === 0 ? (
            <p className="text-sm text-gray-600">No agents registered</p>
          ) : (
            <div className="space-y-2">
              {agents.map(agent => (
                <div key={agent.id} className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={agent.status} />
                    <span className="text-sm">{agent.definitionId}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {agent.tokenUsage.total.toLocaleString()} tokens
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Running Tasks */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Running Tasks ({runningTasks.length})
          </h3>
          {runningTasks.length === 0 ? (
            <p className="text-sm text-gray-600">No tasks running</p>
          ) : (
            <div className="space-y-2">
              {runningTasks.map(task => (
                <div key={task.id} className="bg-surface-2 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{task.title}</span>
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Agent: {task.assignedAgent || 'unassigned'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Recent Activity</h3>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-gray-600">No activity yet</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recentLogs.slice(0, 20).map(log => (
              <div key={log.id} className="flex items-start gap-2 text-xs py-1">
                <span className="text-gray-600 font-mono shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 ${
                  log.level === 'error' ? 'text-danger' :
                  log.level === 'warn' ? 'text-warning' :
                  'text-gray-500'
                }`}>
                  [{log.level}]
                </span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
