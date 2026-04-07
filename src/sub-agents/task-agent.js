const prisma = require('../db');

class TaskAgent {
  constructor() {
    this.name = 'TaskAgent';
    this.description = 'Manages to-do lists, priorities, and task status.';
  }

  // MCP-style tool definitions
  getTools() {
    return [
      {
        name: 'add_task',
        description: 'Creates a new task in the database.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            description: { type: 'string', description: 'Task notes' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            dueDate: { type: 'string', description: 'ISO date string' },
            projectId: { type: 'string', description: 'Project ID to link to' }
          },
          required: ['title']
        }
      },
      {
        name: 'get_tasks',
        description: 'Retrieves a list of tasks filtered by status, priority, or project.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'completed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            projectId: { type: 'string' }
          }
        }
      },
      {
        name: 'update_task',
        description: 'Updates a task status, priority, or linked project.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Task ID' },
            status: { type: 'string', enum: ['pending', 'completed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            projectId: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_task',
        description: 'Removes a task from the system.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    ];
  }

  async add_task(args) {
    const { title, description, priority, dueDate, projectId } = args;
    console.log(`[TaskAgent] Creating task: ${title}`);
    const data = {
      title,
      description: description || '',
      priority: priority || 'medium',
    };
    if (dueDate) data.dueDate = new Date(dueDate);
    if (projectId) data.projectId = projectId;
    const task = await prisma.task.create({ data });
    return `Task created with ID: ${task.id}`;
  }

  async get_tasks(args) {
    const where = {};
    if (args && args.status) where.status = args.status;
    if (args && args.priority) where.priority = args.priority;
    if (args && args.projectId) where.projectId = args.projectId;
    const tasks = await prisma.task.findMany({ 
      where, 
      orderBy: { createdAt: 'desc' },
      include: { project: true }
    });
    return JSON.stringify(tasks);
  }

  async update_task(args) {
    const { id, status, priority, title, projectId } = args;
    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (title) updateData.title = title;
    if (projectId) updateData.projectId = projectId;
    await prisma.task.update({ where: { id }, data: updateData });
    return `Task ${id} updated.`;
  }

  async delete_task(args) {
    const { id } = args;
    await prisma.task.delete({ where: { id } });
    return `Task ${id} deleted.`;
  }
}

module.exports = new TaskAgent();
