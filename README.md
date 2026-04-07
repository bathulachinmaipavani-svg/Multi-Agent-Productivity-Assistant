# 🤖 Multi-Agent AI System

A powerful multi-agent AI system built for task management, scheduling, and information retrieval. This system demonstrates advanced coordination between a primary **Coordinator** and specialized sub-agents.

## 🚀 Key Features

- **Multi-Agent Coordination**: A primary agent routes complex requests to specialized sub-agents.
- **Workflow Automation**: Handles multi-step real-world workflows like project planning and meeting preparation.
- **MCP Tool Integration**: Agents expose tools via the **Model Context Protocol (MCP)** standard.
- **Persistent Memory**: Uses a structured database (Prisma + SQLite) for long-term storage and retrieval.
- **Real-time Dashboard**: A premium, interactive UI to monitor agent thoughts and system state.

## 🏗 System Architecture

- **Coordinator**: The "brain" that classifies intent and manages the state machine for multi-agent workflows.
- **TaskAgent**: Manages to-do lists, priorities, and deadlines.
- **CalendarAgent**: Handles event scheduling and availability.
- **MemoryAgent**: Stores and retrieves unstructured notes and historical information.

---

## 🛠 Required Goals Met

1.  **Primary Agent Coordination**: Implemented via `src/coordinator.js`.
2.  **Structured Data Storage**: Uses **Prisma** with SQLite to store tasks, events, notes, and agent logs.
3.  **MCP Tool Integration**: Each agent implements `getTools()` returning MCP-compliant tool definitions.
4.  **Multi-Step Workflows**: Workflows like `PLAN_PROJECT` coordinate across all 3 sub-agents sequentially.
5.  **API Deployment**: Built with **Express**, providing a robust REST API for chat and dashboard data.

---

## 🏃 How to Run the Program

### 1. Prerequisites
- Node.js (v18+)
- A Google Gemini API Key (Optional but recommended for AI-powered intent classification)

### 2. Environment Setup
Create a `.env` file in the root directory (or update the existing one):
```env
DATABASE_URL="file:./prisma/dev.db"
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Initialization
This will sync the Prisma schema with your local SQLite database and generate the client.
```bash
npm run db:push
npm run db:generate
```

### 5. Start the System
```bash
npm run dev
```

### 6. Access the Dashboard
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Demo Workflows to Try

Once the system is running, try typing these into the chat:
- **"Plan a website redesign project"** (Coordinates Memory → Task → Calendar)
- **"Prepare for my hackathon demo meeting"** (Coordinates Memory → Task → Calendar)
- **"Give me a weekly review"** (Aggregates data from all 3 agents)
- **"Remember that the server password is 'admin123'"** (MemoryAgent)
- **"Schedule a kickoff call for tomorrow at 10 AM"** (CalendarAgent)

---

## 📁 Project Structure
- `src/coordinator.js`: Main logic for agent routing and workflow management.
- `src/sub-agents/`: Individual specialized agents with MCP tool definitions.
- `src/db.js`: Prisma client initialization.
- `public/`: Frontend dashboard assets.
- `prisma/`: Database schema and migrations.
