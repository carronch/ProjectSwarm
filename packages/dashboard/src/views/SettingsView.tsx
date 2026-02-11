import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket.tsx';

export function SettingsView() {
  const { connected, stats } = useWebSocket();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>

      {/* Connection Status */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Connection</h3>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${connected ? 'bg-success' : 'bg-danger animate-pulse'}`} />
          <span className="text-sm">{connected ? 'Connected to gateway' : 'Disconnected'}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Gateway: ws://localhost:8080/ws</p>
      </div>

      {/* Model Configuration */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Model Configuration</h3>
        <p className="text-xs text-gray-500 mb-3">Edit config/models.json to change model settings. Restart the gateway after changes.</p>
        <div className="bg-surface-2 rounded-lg p-3 text-xs font-mono text-gray-400">
          <p>Primary: claude-sonnet-4-20250514</p>
          <p>Fallback: claude-3-5-haiku-20241022</p>
          <p>Provider: Anthropic</p>
        </div>
      </div>

      {/* Usage Today */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Usage Today</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-xs text-gray-500">Tokens</p>
            <p className="text-lg font-mono">{stats.totalTokensToday.toLocaleString()}</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-xs text-gray-500">Estimated Cost</p>
            <p className="text-lg font-mono">${stats.estimatedCostToday.toFixed(4)}</p>
          </div>
        </div>
      </div>

      {/* Safety Guardrails */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Safety Guardrails</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Require approval for all tasks</p>
              <p className="text-xs text-gray-500">Tasks go to review status before completing</p>
            </div>
            <span className="badge bg-success/20 text-success">Enabled</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Audit logging</p>
              <p className="text-xs text-gray-500">All agent actions are logged</p>
            </div>
            <span className="badge bg-success/20 text-success">Enabled</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Daily spend limit</p>
              <p className="text-xs text-gray-500">Auto-pause when limit reached</p>
            </div>
            <span className="badge bg-gray-500/20 text-gray-400">Not configured</span>
          </div>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Configuration Files</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <p><code className="text-accent">config/agents.json</code> — Agent definitions and capabilities</p>
          <p><code className="text-accent">config/models.json</code> — LLM provider configuration</p>
          <p><code className="text-accent">.env</code> — API keys and environment variables</p>
        </div>
      </div>
    </div>
  );
}
