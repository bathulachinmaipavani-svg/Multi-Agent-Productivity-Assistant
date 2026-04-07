const prisma = require('../db');

class ProjectAgent {
  constructor() {
    this.name = 'ProjectAgent';
    this.description = 'Manages high-level projects, milestones, and project-task grouping.';
  }

  getTools() {
    return [
      {
        name: 'create_project',
        description: 'Creates a new high-level project.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name' },
            description: { type: 'string', description: 'Project overview' },
            status: { type: 'string', enum: ['active', 'completed', 'on-hold'] }
          },
          required: ['name']
        }
      },
      {
        name: 'get_projects',
        description: 'Retrieves all projects with their tasks.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'update_project',
        description: 'Updates project status or name.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: ['active', 'completed', 'on-hold'] },
            name: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_project',
        description: 'Deletes a project (warning: also unlinks tasks).',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    ];
  }

  async create_project(args) {
    const { name, description, status } = args;
    const project = await prisma.project.create({
      data: { name, description: description || '', status: status || 'active' }
    });
    return `Project created with ID: ${project.id}`;
  }

  async get_projects(args) {
    const projects = await prisma.project.findMany({
      include: { tasks: true },
      orderBy: { createdAt: 'desc' }
    });
    return JSON.stringify(projects);
  }

  async update_project(args) {
    const { id, status, name } = args;
    const data = {};
    if (status) data.status = status;
    if (name) data.name = name;
    await prisma.project.update({ where: { id }, data });
    return `Project ${id} updated.`;
  }

  async delete_project(args) {
    const { id } = args;
    await prisma.project.delete({ where: { id } });
    return `Project ${id} deleted.`;
  }
}

module.exports = new ProjectAgent();
