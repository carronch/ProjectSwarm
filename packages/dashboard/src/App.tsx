import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.tsx';
import { OverviewView } from './views/OverviewView.tsx';
import { TasksView } from './views/TasksView.tsx';
import { MemoryView } from './views/MemoryView.tsx';
import { AgentsView } from './views/AgentsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';

export function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <Routes>
          <Route path="/" element={<OverviewView />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/memory" element={<MemoryView />} />
          <Route path="/agents" element={<AgentsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
    </div>
  );
}
