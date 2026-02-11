import React, { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import type {
  DashboardSnapshot,
  AgentState,
  Task,
  TaskLogEntry,
  SystemStats,
  WsMessage,
} from '@agent-dashboard/shared';

interface WebSocketState {
  connected: boolean;
  agents: AgentState[];
  tasks: Task[];
  recentLogs: TaskLogEntry[];
  stats: SystemStats;
  sendMessage: (msg: Omit<WsMessage, 'id' | 'timestamp'>) => void;
}

const defaultStats: SystemStats = {
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  activeAgents: 0,
  totalTokensToday: 0,
  estimatedCostToday: 0,
};

const WebSocketContext = createContext<WebSocketState>({
  connected: false,
  agents: [],
  tasks: [],
  recentLogs: [],
  stats: defaultStats,
  sendMessage: () => {},
});

export function useWebSocket(): WebSocketState {
  return useContext(WebSocketContext);
}

const WS_URL = `ws://${window.location.hostname}:8080/ws`;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentLogs, setRecentLogs] = useState<TaskLogEntry[]>([]);
  const [stats, setStats] = useState<SystemStats>(defaultStats);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('WebSocket connected');
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('WebSocket disconnected, reconnecting...');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);

      switch (msg.type) {
        case 'state:snapshot': {
          const snapshot = msg.payload as DashboardSnapshot;
          setAgents(snapshot.agents);
          setTasks(snapshot.tasks);
          setRecentLogs(snapshot.recentLogs);
          setStats(snapshot.stats);
          break;
        }
        case 'agent:updated': {
          const agent = msg.payload as AgentState;
          setAgents(prev => {
            const idx = prev.findIndex(a => a.id === agent.id || a.definitionId === agent.definitionId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = agent;
              return next;
            }
            return [...prev, agent];
          });
          break;
        }
        case 'task:updated': {
          const task = msg.payload as Task;
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === task.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = task;
              return next;
            }
            return [task, ...prev];
          });
          break;
        }
        case 'task:log': {
          const entry = msg.payload as TaskLogEntry;
          setRecentLogs(prev => [entry, ...prev].slice(0, 100));
          break;
        }
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: Omit<WsMessage, 'id' | 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...msg,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }));
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, agents, tasks, recentLogs, stats, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}
