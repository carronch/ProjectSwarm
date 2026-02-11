import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';

export function AgentsView() {
  const { agents, tasks, recentLogs } = useWebSocket();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Agents</h2>

      {agents.length === 0 ? (
        <div className="card">
          <p className="text-sm text-gray-500">No agents registered. Configure agents in config/agents.json and restart the gateway.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map(agent => {
            const agentTasks = tasks.filter(t => t.assignedAgent === agent.definitionId);
            const agentLogs = recentLogs.filter(l => l.agentId === agent.definitionId);
            const completedCount = agentTasks.filter(t => t.status === 'completed').length;
            const failedCount = agentTasks.filter(t => t.status === 'failed').length;

            return (
              <div key={agent.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{agent.definitionId}</h3>
                      <StatusBadge status={agent.status} />
                    </div>
                    {agent.currentTaskId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Working on: {tasks.find(t => t.id === agent.currentTaskId)?.title || agent.currentTaskId}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>Errors: {agent.errorCount}</p>
                    <p>Last active: {new Date(agent.lastActivity).toLocaleTimeString()}</p>
                  </div>
                </div>

                {/* Token usage */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-surface-2 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Prompt Tokens</p>
                    <p className="text-sm font-mono">{agent.tokenUsage.prompt.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Completion Tokens</p>
                    <p className="text-sm font-mono">{agent.tokenUsage.completion.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Tasks (Done / Failed)</p>
                    <p className="text-sm font-mono">
                      <span className="text-success">{completedCount}</span>
                      {' / '}
                      <span className="text-danger">{failedCount}</span>
                    </p>
                  </div>
                </div>

                {/* Recent logs for this agent */}
                {agentLogs.length > 0 && (
                  <details>
                    <summary className="text-xs text-gray-500 cursor-pointer">Recent activity ({agentLogs.length})</summary>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {agentLogs.slice(0, 10).map(log => (
                        <div key={log.id} className="flex items-start gap-2 text-xs py-0.5">
                          <span className="text-gray-600 font-mono shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={
                            log.level === 'error' ? 'text-danger' :
                            log.level === 'warn' ? 'text-warning' :
                            'text-gray-500'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
