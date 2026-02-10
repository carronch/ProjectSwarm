const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Tasks ──────────────────────────────────────────

export async function fetchTasks(status?: string) {
  const params = status ? `?status=${status}` : '';
  return request(`/tasks${params}`);
}

export async function createTask(input: {
  title: string;
  description: string;
  type: string;
  priority?: number;
  assignedAgent?: string;
}) {
  return request('/tasks', { method: 'POST', body: JSON.stringify(input) });
}

export async function approveTask(taskId: string) {
  return request(`/tasks/${taskId}/approve`, { method: 'POST' });
}

export async function rejectTask(taskId: string) {
  return request(`/tasks/${taskId}/reject`, { method: 'POST' });
}

export async function fetchTaskLogs(taskId: string) {
  return request(`/tasks/${taskId}/logs`);
}

// ─── Memory ─────────────────────────────────────────

export async function fetchSemanticMemory(query?: string, category?: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  const qs = params.toString();
  return request(`/memory/semantic${qs ? `?${qs}` : ''}`);
}

export async function createSemanticMemory(input: {
  category: string;
  key: string;
  value: string;
  source?: string;
  confidence?: number;
}) {
  return request('/memory/semantic', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteSemanticMemory(id: string) {
  return request(`/memory/semantic/${id}`, { method: 'DELETE' });
}

export async function fetchEpisodicMemory(query?: string, agent?: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (agent) params.set('agent', agent);
  const qs = params.toString();
  return request(`/memory/episodic${qs ? `?${qs}` : ''}`);
}

// ─── Agents ─────────────────────────────────────────

export async function fetchAgents() {
  return request('/agents');
}

// ─── Snapshot ───────────────────────────────────────

export async function fetchSnapshot() {
  return request('/snapshot');
}
