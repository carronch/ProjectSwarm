import React, { useState, useEffect } from 'react';
import type { SemanticMemory, EpisodicMemory, MemoryCategory } from '@agent-dashboard/shared';
import { fetchSemanticMemory, fetchEpisodicMemory, createSemanticMemory, deleteSemanticMemory } from '../lib/api.ts';

type Tab = 'semantic' | 'episodic';

export function MemoryView() {
  const [tab, setTab] = useState<Tab>('semantic');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [semanticData, setSemanticData] = useState<SemanticMemory[]>([]);
  const [episodicData, setEpisodicData] = useState<EpisodicMemory[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadData = async () => {
    if (tab === 'semantic') {
      const data = await fetchSemanticMemory(searchQuery || undefined, categoryFilter || undefined);
      setSemanticData(data as SemanticMemory[]);
    } else {
      const data = await fetchEpisodicMemory(searchQuery || undefined);
      setEpisodicData(data as EpisodicMemory[]);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab, searchQuery, categoryFilter]);

  const handleDelete = async (id: string) => {
    await deleteSemanticMemory(id);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Memory</h2>
        <button className="btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
          + Add Memory
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-1 rounded-lg p-1 w-fit">
        {(['semantic', 'episodic'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm transition-colors ${
              tab === t ? 'bg-surface-3 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'semantic' ? 'Facts & Rules' : 'Past Actions'}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <input
          className="input flex-1"
          placeholder={`Search ${tab} memory...`}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {tab === 'semantic' && (
          <select className="input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            <option value="supplier">Supplier</option>
            <option value="client">Client</option>
            <option value="rule">Rule</option>
            <option value="preference">Preference</option>
            <option value="general">General</option>
          </select>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <CreateMemoryForm
          onClose={() => setShowCreateForm(false)}
          onCreated={loadData}
        />
      )}

      {/* Data */}
      {tab === 'semantic' ? (
        <SemanticMemoryList data={semanticData} onDelete={handleDelete} />
      ) : (
        <EpisodicMemoryList data={episodicData} />
      )}
    </div>
  );
}

function SemanticMemoryList({ data, onDelete }: { data: SemanticMemory[]; onDelete: (id: string) => void }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-600">No semantic memories found. Add facts about your businesses, clients, and rules.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map(mem => (
        <div key={mem.id} className="card group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge bg-accent/20 text-accent-hover">{mem.category}</span>
                <span className="text-sm font-medium">{mem.key}</span>
                <span className="text-xs text-gray-600">
                  confidence: {(mem.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm text-gray-300">{mem.value}</p>
              <p className="text-xs text-gray-600 mt-1">
                Source: {mem.source} | Updated: {new Date(mem.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => onDelete(mem.id)}
              className="btn-ghost text-xs opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-danger"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EpisodicMemoryList({ data }: { data: EpisodicMemory[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-600">No episodic memories yet. They are created as agents complete tasks.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map(mem => (
        <div key={mem.id} className="card">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${
              mem.outcome === 'success' ? 'bg-success/20 text-success' :
              mem.outcome === 'failed' ? 'bg-danger/20 text-danger' :
              'bg-warning/20 text-warning'
            }`}>
              {mem.outcome}
            </span>
            <span className="text-xs text-gray-500">Agent: {mem.agentId}</span>
            <span className="text-xs text-gray-600">{new Date(mem.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-gray-300">{mem.summary}</p>
          {mem.lessons && (
            <p className="text-xs text-gray-500 mt-1">Lessons: {mem.lessons}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function CreateMemoryForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [category, setCategory] = useState<MemoryCategory>('general');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [confidence, setConfidence] = useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;
    await createSemanticMemory({ category, key, value, confidence });
    onCreated();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select className="input w-full" value={category} onChange={e => setCategory(e.target.value as MemoryCategory)}>
            <option value="general">General</option>
            <option value="supplier">Supplier</option>
            <option value="client">Client</option>
            <option value="rule">Rule</option>
            <option value="preference">Preference</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Confidence</label>
          <input type="range" min="0" max="1" step="0.1" value={confidence} onChange={e => setConfidence(Number(e.target.value))} className="w-full" />
          <span className="text-xs text-gray-500">{(confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Key</label>
        <input className="input w-full" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. VAT rate, Supplier X payment terms" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Value</label>
        <textarea className="input w-full h-20 resize-none" value={value} onChange={e => setValue(e.target.value)} placeholder="The fact or rule to remember..." />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary">Save Memory</button>
      </div>
    </form>
  );
}
