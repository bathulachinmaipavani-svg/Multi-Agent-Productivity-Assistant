const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const coordinator = require('./coordinator');
const prisma = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// API Endpoint to interact with the AI Agent
app.post('/api/agent', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        const response = await coordinator.processRequest(query);
        res.json({ success: true, response });
    } catch (error) {
        console.error("Agent processing error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// Endpoint to get activity logs
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await prisma.agentLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get all data (for the dashboard)
app.get('/api/dashboard', async (req, res) => {
    try {
        const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
        const events = await prisma.event.findMany({ orderBy: { startTime: 'asc' } });
        const notes = await prisma.note.findMany({ orderBy: { createdAt: 'desc' } });
        res.json({ tasks, events, notes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
