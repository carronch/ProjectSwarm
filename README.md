# ProjectSwarm — Personal Agent Dashboard & Coordination System

A personal AI agent system with a visual dashboard for monitoring and controlling multiple specialized agents. Designed for business automation (accounting, CRM, booking, supplier comms).

## Architecture

```
packages/
  shared/       # Shared TypeScript types
  gateway/      # WebSocket + HTTP API server, agent runtime, memory & task systems
  dashboard/    # React + Tailwind dashboard UI
config/         # Agent definitions, model configuration
db/             # SQLite schema
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config and add your API key
cp .env.example .env

# Initialize the database
npm run db:init

# Start both gateway and dashboard in development mode
npm run dev
```

- **Dashboard**: http://localhost:3000
- **Gateway API**: http://localhost:8080/api
- **WebSocket**: ws://localhost:8080/ws

## CLI

```bash
npm run cli
```

Available commands: `task create`, `task list`, `memory add`, `memory search`, `stats`, `help`

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **LLM**: Anthropic Claude API (primary), extensible to OpenAI/OpenRouter
- **Dashboard**: React + Vite + Tailwind CSS
- **Database**: SQLite (via better-sqlite3)
- **Real-time**: WebSocket (ws)
- **Monorepo**: npm workspaces