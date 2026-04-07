const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const coordinator = require('./coordinator');
const prisma = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// POST /api/chat — main multi-agent entry point
app.post('/api/chat', async (req, res) => {
  const { query, targetAgent } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  try {
    const result = await coordinator.processRequest(query, targetAgent);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/action — direct management entry point (Complete, Delete, etc.)
app.post('/api/action', async (req, res) => {
  const { type, action, args } = req.body; // e.g., type="task", action="delete_task", args={id: "..."}
  try {
    const taskAgent = require('./sub-agents/task-agent');
    const calendarAgent = require('./sub-agents/calendar-agent');
    const memoryAgent = require('./sub-agents/memory-agent');
    const projectAgent = require('./sub-agents/project-agent');

    let result;
    if (type === 'task') result = await taskAgent[action](args);
    else if (type === 'event') result = await calendarAgent[action](args);
    else if (type === 'note') result = await memoryAgent[action](args);
    else if (type === 'project') result = await projectAgent[action](args);
    else throw new Error('Invalid type');

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const [tasks, events, notes, projects, logs] = await Promise.all([
      prisma.task.findMany({ 
        orderBy: { createdAt: 'desc' }, 
        take: 20,
        include: { project: true }
      }),
      prisma.event.findMany({ orderBy: { startTime: 'asc' }, take: 10 }),
      prisma.note.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.project.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.agentLog.findMany({ orderBy: { timestamp: 'desc' }, take: 30 }),
    ]);
    res.json({ tasks, events, notes, projects, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tools — MCP Tool discovery endpoint
app.get('/api/tools', (req, res) => {
  const taskAgent = require('./sub-agents/task-agent');
  const calendarAgent = require('./sub-agents/calendar-agent');
  const memoryAgent = require('./sub-agents/memory-agent');
  const projectAgent = require('./sub-agents/project-agent');

  res.json({
    TaskAgent: taskAgent.getTools(),
    CalendarAgent: calendarAgent.getTools(),
    MemoryAgent: memoryAgent.getTools(),
    ProjectAgent: projectAgent.getTools()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Multi-Agent AI System running at http://localhost:${PORT}\n`);
});
