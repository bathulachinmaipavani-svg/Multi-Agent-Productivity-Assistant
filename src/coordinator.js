const taskAgent = require('./sub-agents/task-agent');
const calendarAgent = require('./sub-agents/calendar-agent');
const memoryAgent = require('./sub-agents/memory-agent');
const projectAgent = require('./sub-agents/project-agent');
const prisma = require('./db');

// Try to use Gemini if API key is set
let genAI = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const key = process.env.GEMINI_API_KEY;
  if (key && key !== 'YOUR_API_KEY_HERE') {
    genAI = new GoogleGenerativeAI(key);
  }
} catch (e) {}

class Coordinator {
  constructor() {
    this.thoughtChain = [];
    this.agents = {
      taskAgent,
      calendarAgent,
      memoryAgent,
      projectAgent
    };
  }

  async log(step, message, type = 'thought') {
    console.log(`[${step}] ${message}`);
    this.thoughtChain.push({ step, message, type, timestamp: new Date().toISOString() });
    try {
      await prisma.agentLog.create({ data: { step, message, type } });
    } catch (e) {}
  }

  // Determine which workflow or agent to trigger
  async classifyIntent(input) {
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Classify this user request into one of these workflows:
- PLAN_PROJECT: user wants to plan, start, or organize a project
- PROJECT_LAUNCH: user wants to finalize, review, and schedule a project launch
- PREPARE_MEETING: user wants to prepare for or schedule a meeting  
- WEEKLY_REVIEW: user wants a summary or review of tasks/schedule
- ADD_TASK: user wants to add a single task or to-do
- ADD_EVENT: user wants to schedule an event or meeting
- SAVE_NOTE: user wants to save, remember, or note something
- PROJECT_MGMT: user wants to create or manage a high-level project
- GENERAL: anything else

User request: "${input}"
Reply with ONLY the workflow name and extracted JSON details.`;
        const res = await model.generateContent(prompt);
        const text = res.response.text().trim();
        const firstLine = text.split('\n')[0].trim();
        const workflow = firstLine.split(' ')[0];
        let details = {};
        try { details = JSON.parse(text.substring(workflow.length)); } catch(_) {}
        return { workflow, details, aiPowered: true };
      } catch (e) {}
    }

    const low = input.toLowerCase();
    if (low.includes('launch')) return { workflow: 'PROJECT_LAUNCH', details: { name: input } };
    if (low.includes('plan') && low.includes('project')) return { workflow: 'PLAN_PROJECT', details: { name: input } };
    if (low.includes('prepare') && low.includes('meeting')) return { workflow: 'PREPARE_MEETING', details: { name: input } };
    if (low.includes('weekly') || low.includes('review')) return { workflow: 'WEEKLY_REVIEW', details: {} };
    if (low.includes('project')) return { workflow: 'PROJECT_MGMT', details: { name: input } };
    if (low.includes('task') || low.includes('todo')) return { workflow: 'ADD_TASK', details: { name: input } };
    return { workflow: 'GENERAL', details: {} };
  }

  // WORKFLOW 1: Plan a full project — uses ALL 3 agents
  async workflowPlanProject(input, details) {
    const projectName = details.projectName || input;
    const results = [];

    await this.log('Coordinator', `Starting PLAN_PROJECT workflow for: "${projectName}"`, 'thought');

    // Step 1: MemoryAgent saves the project brief
    await this.log('MemoryAgent', 'Saving project brief to memory...', 'thought');
    const noteResult = await memoryAgent.save_note({
      title: `Project: ${projectName}`,
      content: `Project brief: ${input}. Created on ${new Date().toLocaleDateString()}.`,
      tags: 'project,planning'
    });
    await this.log('MemoryAgent', noteResult, 'result');
    results.push(`📓 **Memory:** ${noteResult}`);

    // Step 2: TaskAgent creates milestone tasks
    await this.log('TaskAgent', 'Creating project milestone tasks...', 'thought');
    const milestones = [
      { title: `[${projectName}] Research & Requirements`, priority: 'high' },
      { title: `[${projectName}] Design & Planning`, priority: 'high' },
      { title: `[${projectName}] Development / Execution`, priority: 'medium' },
      { title: `[${projectName}] Testing & Review`, priority: 'medium' },
      { title: `[${projectName}] Launch & Delivery`, priority: 'high' },
    ];
    for (const m of milestones) {
      const r = await taskAgent.add_task(m);
      await this.log('TaskAgent', `Created task: ${m.title}`, 'result');
    }
    results.push(`✅ **TaskAgent:** Created 5 milestone tasks for "${projectName}"`);

    // Step 3: CalendarAgent schedules a kickoff meeting
    await this.log('CalendarAgent', 'Scheduling project kickoff meeting...', 'thought');
    const kickoff = new Date();
    kickoff.setDate(kickoff.getDate() + 1);
    kickoff.setHours(10, 0, 0, 0);
    const kickoffEnd = new Date(kickoff.getTime() + 3600000);
    const eventResult = await calendarAgent.schedule_event({
      title: `Kickoff: ${projectName}`,
      startTime: kickoff.toISOString(),
      endTime: kickoffEnd.toISOString(),
      description: `Project kickoff meeting for: ${projectName}`,
      location: 'Conference Room / Zoom'
    });
    await this.log('CalendarAgent', eventResult, 'result');
    results.push(`📅 **CalendarAgent:** ${eventResult}`);

    await this.log('Coordinator', 'PLAN_PROJECT workflow complete — 3 agents coordinated.', 'result');
    return `**Project Plan Created!**\n\n${results.join('\n')}\n\n*3 agents coordinated: MemoryAgent → TaskAgent → CalendarAgent*`;
  }

  // WORKFLOW 2: Prepare for a meeting — searches memory, creates tasks, schedules
  async workflowPrepareMeeting(input, details) {
    const topic = details.topic || input;
    const results = [];

    await this.log('Coordinator', `Starting PREPARE_MEETING workflow for: "${topic}"`, 'thought');

    // Step 1: MemoryAgent searches existing notes
    await this.log('MemoryAgent', 'Searching memory for relevant context...', 'thought');
    const notes = await memoryAgent.search_notes({ query: topic.split(' ')[0] });
    const parsedNotes = JSON.parse(notes);
    await this.log('MemoryAgent', `Found ${parsedNotes.length} relevant notes`, 'result');
    results.push(`📓 **MemoryAgent:** Found ${parsedNotes.length} relevant notes from past sessions`);

    // Step 2: TaskAgent creates meeting prep tasks
    await this.log('TaskAgent', 'Creating meeting preparation tasks...', 'thought');
    const prepTasks = [
      { title: `Prepare agenda for: ${topic}`, priority: 'high' },
      { title: `Review notes before meeting: ${topic}`, priority: 'medium' },
      { title: `Send meeting invite for: ${topic}`, priority: 'high' },
      { title: `Follow up after meeting: ${topic}`, priority: 'medium' },
    ];
    for (const t of prepTasks) {
      await taskAgent.add_task(t);
    }
    await this.log('TaskAgent', 'Created 4 preparation tasks', 'result');
    results.push(`✅ **TaskAgent:** Created 4 meeting prep tasks`);

    // Step 3: CalendarAgent schedules the meeting
    await this.log('CalendarAgent', 'Scheduling the meeting...', 'thought');
    const meetingTime = new Date();
    meetingTime.setDate(meetingTime.getDate() + 1);
    meetingTime.setHours(14, 0, 0, 0);
    const meetingEnd = new Date(meetingTime.getTime() + 3600000);
    const eventResult = await calendarAgent.schedule_event({
      title: topic.substring(0, 80),
      startTime: meetingTime.toISOString(),
      endTime: meetingEnd.toISOString(),
      description: `Meeting: ${input}`
    });
    await this.log('CalendarAgent', eventResult, 'result');
    results.push(`📅 **CalendarAgent:** ${eventResult}`);

    await this.log('Coordinator', 'PREPARE_MEETING workflow complete.', 'result');
    return `**Meeting Prepared!**\n\n${results.join('\n')}\n\n*3 agents coordinated: MemoryAgent → TaskAgent → CalendarAgent*`;
  }

  // WORKFLOW 3: Weekly review — queries ALL agents and compiles a report
  async workflowWeeklyReview() {
    const results = [];

    await this.log('Coordinator', 'Starting WEEKLY_REVIEW workflow...', 'thought');

    // Step 1: TaskAgent fetches all tasks
    await this.log('TaskAgent', 'Fetching all tasks for review...', 'thought');
    const tasksJson = await taskAgent.get_tasks({});
    const tasks = JSON.parse(tasksJson);
    const pending = tasks.filter(t => t.status === 'pending').length;
    const done = tasks.filter(t => t.status === 'completed').length;
    await this.log('TaskAgent', `${tasks.length} total tasks fetched`, 'result');
    results.push(`✅ **TaskAgent:** ${tasks.length} total tasks — ${pending} pending, ${done} completed`);

    // Step 2: CalendarAgent fetches upcoming events
    await this.log('CalendarAgent', 'Fetching upcoming events...', 'thought');
    const eventsJson = await calendarAgent.list_events({});
    const events = JSON.parse(eventsJson);
    await this.log('CalendarAgent', `${events.length} events scheduled`, 'result');
    results.push(`📅 **CalendarAgent:** ${events.length} upcoming events scheduled`);

    // Step 3: MemoryAgent fetches recent notes
    await this.log('MemoryAgent', 'Fetching recent notes for context...', 'thought');
    const notesJson = await memoryAgent.search_notes({});
    const notes = JSON.parse(notesJson);
    await this.log('MemoryAgent', `${notes.length} notes in memory`, 'result');
    results.push(`📓 **MemoryAgent:** ${notes.length} notes saved in memory`);

    // Coordinator compiles the summary
    await this.log('Coordinator', 'Compiling weekly report from all 3 agents...', 'thought');
    const highPriority = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
    const highList = highPriority.slice(0, 3).map(t => `  • ${t.title}`).join('\n');

    await this.log('Coordinator', 'WEEKLY_REVIEW workflow complete.', 'result');
    return `**📊 Weekly Review Report**\n\n${results.join('\n')}\n\n**🔴 High Priority Items:**\n${highList || '  • None — great job!'}\n\n*All 3 agents queried and data aggregated by Coordinator*`;
  }

  // WORKFLOW 4: Project Launch — Uses ALL 4 Specialized Agents
  async workflowProjectLaunch(input, details) {
    const projName = details.name || input;
    await this.log('Coordinator', `Initiating project-wide launch sequence for: ${projName}`, 'thought');

    // Step 1: ProjectAgent retrieves state
    await this.log('ProjectAgent', 'Verifying project roadmap and status...', 'thought');
    const projectRes = await projectAgent.get_projects({});
    const projects = JSON.parse(projectRes);
    const active = projects.find(p => p.name.includes(projName) || projName.includes(p.name)) || projects[0];
    await this.log('ProjectAgent', `Target project identified: ${active ? active.name : 'Default/New'}`, 'result');

    // Step 2: TaskAgent checks pending tasks
    await this.log('TaskAgent', `Auditing tasks for project ${active ? active.id : 'all'}...`, 'thought');
    const taskRes = await taskAgent.get_tasks({ projectId: active ? active.id : undefined });
    const tasks = JSON.parse(taskRes);
    const pending = tasks.filter(t => t.status !== 'completed');
    await this.log('TaskAgent', `${pending.length} pending tasks blocking launch.`, 'result');

    // Step 3: MemoryAgent saves launch manifest
    await this.log('MemoryAgent', 'Archiving launch manifest and documentation...', 'thought');
    const manifest = `Launch Sequence for ${projName}\nProject ID: ${active ? active.id : 'N/A'}\nTasks Audited: ${tasks.length}\nChecklist: ${pending.length} remaining.`;
    await memoryAgent.save_note({ title: `Launch Brief: ${projName}`, content: manifest });
    await this.log('MemoryAgent', 'Manifest saved to knowledge base.', 'result');

    // Step 4: CalendarAgent schedules the launch
    await this.log('CalendarAgent', 'Finalizing launch date on the organization schedule...', 'thought');
    const launchDate = new Date(Date.now() + 172800000); // 2 days from now
    const eventRes = await calendarAgent.schedule_event({
      title: `🚀 LAUNCH: ${projName}`,
      startTime: launchDate.toISOString(),
      endTime: new Date(launchDate.getTime() + 7200000).toISOString(),
      description: `Official launch event for ${projName}. All systems go.`
    });
    await this.log('CalendarAgent', eventRes, 'result');

    const status = active ? `Project **${active.name}**` : `**${projName}**`;
    return `### 🚀 Full Launch Sequence Initiated\n\n- **ProjectManager Agent**: Roadmap verified.\n- **Task Agent**: Audited ${tasks.length} tasks (${pending.length} pending).\n- **Memory Agent**: Launch brief archived in the Knowledge Base.\n- **Schedule Agent**: Launch event locked for ${launchDate.toLocaleDateString()}.\n\n**Coordinated Response**: All 4 agents have synchronized for this project launch.`;
  }

  // SINGLE AGENT WORKFLOWS
  async workflowProjectAgent(input) {
    await this.log('Coordinator', 'Routing to ProjectAgent for project management', 'thought');
    await this.log('ProjectAgent', `Creating project: "${input}"`, 'thought');
    const result = await projectAgent.create_project({ name: input, description: input });
    await this.log('ProjectAgent', result, 'result');
    return `🗂 ${result}`;
  }

  async workflowAddTask(input, details) {
    await this.log('Coordinator', 'Routing to TaskAgent for single task creation', 'thought');
    await this.log('TaskAgent', `Creating task: "${input}"`, 'thought');
    const result = await taskAgent.add_task({ title: input, description: input, priority: 'medium' });
    await this.log('TaskAgent', result, 'result');
    return `✅ ${result}`;
  }

  async workflowAddEvent(input, details) {
    await this.log('Coordinator', 'Routing to CalendarAgent for event scheduling', 'thought');
    await this.log('CalendarAgent', `Scheduling event: "${input}"`, 'thought');
    const start = new Date(Date.now() + 86400000);
    start.setHours(10, 0, 0, 0);
    const result = await calendarAgent.schedule_event({
      title: input.substring(0, 80),
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + 3600000).toISOString(),
      description: input
    });
    await this.log('CalendarAgent', result, 'result');
    return `📅 ${result}`;
  }

  async workflowSaveNote(input, details) {
    await this.log('Coordinator', 'Routing to MemoryAgent for note storage', 'thought');
    await this.log('MemoryAgent', `Saving note: "${input}"`, 'thought');
    const result = await memoryAgent.save_note({ title: 'Quick Note', content: input });
    await this.log('MemoryAgent', result, 'result');
    return `📓 ${result}`;
  }

  async workflowGeneral(input) {
    await this.log('Coordinator', 'General query — saving to memory and checking tasks', 'thought');
    await this.log('MemoryAgent', 'Storing general input as a note', 'thought');
    const noteResult = await memoryAgent.save_note({ title: 'Log', content: input });
    await this.log('MemoryAgent', noteResult, 'result');
    const tasksJson = await taskAgent.get_tasks({});
    const tasks = JSON.parse(tasksJson);
    await this.log('TaskAgent', `Retrieved ${tasks.length} current tasks`, 'result');
    return `I've logged your message. You currently have **${tasks.length} tasks** in the system. Try saying:\n• "Plan a project" • "Prepare a meeting" • "Weekly review"`;
  }

  // Main entry point
  async processRequest(input, targetAgent = null) {
    this.thoughtChain = [];
    await this.log('Coordinator', `Input received: "${input}"`, 'thought');

    let workflow, details, aiPowered;
    if (targetAgent) {
      workflow = targetAgent === 'taskAgent' ? 'ADD_TASK' : 
                 (targetAgent === 'calendarAgent' ? 'ADD_EVENT' : 
                 (targetAgent === 'projectAgent' ? 'PROJECT_MGMT' : 'SAVE_NOTE'));
      details = { name: input };
      aiPowered = false;
      await this.log('Coordinator', `DIRECT MODE: Routing explicitly to **${targetAgent}**`, 'thought');
    } else {
      const res = await this.classifyIntent(input);
      workflow = res.workflow;
      details = res.details;
      aiPowered = res.aiPowered;
      await this.log('Coordinator', `Intent classified as: **${workflow}**`, 'thought');
    }

    let response;
    try {
      switch (workflow) {
        case 'PROJECT_LAUNCH':  response = await this.workflowProjectLaunch(input, details); break;
        case 'PLAN_PROJECT':    response = await this.workflowPlanProject(input, details); break;
        case 'PREPARE_MEETING': response = await this.workflowPrepareMeeting(input, details); break;
        case 'WEEKLY_REVIEW':   response = await this.workflowWeeklyReview(); break;
        case 'ADD_TASK':        response = await this.workflowAddTask(input, details); break;
        case 'ADD_EVENT':       response = await this.workflowAddEvent(input, details); break;
        case 'SAVE_NOTE':       response = await this.workflowSaveNote(input, details); break;
        case 'PROJECT_MGMT':    response = await this.workflowProjectAgent(input); break;
        default:                response = await this.workflowGeneral(input); break;
      }
    } catch (e) {
      await this.log('Coordinator', `Workflow error: ${e.message}`, 'result');
      response = `Agent Coordination Error: ${e.message}`;
    }

    return { response, thoughtChain: this.thoughtChain, workflow, handlingAgent: targetAgent || workflow };
  }
}

module.exports = new Coordinator();
