const prisma = require('../db');

class CalendarAgent {
  constructor() {
    this.name = "CalendarAgent";
    this.description = "Manages events and schedules.";
  }

  getTools() {
    return [
      {
        name: 'schedule_event',
        description: 'Schedules a new event in the calendar.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            startTime: { type: 'string', description: 'ISO date string' },
            endTime: { type: 'string', description: 'ISO date string' },
            location: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['title', 'startTime', 'endTime']
        }
      },
      {
        name: 'list_events',
        description: 'Lists all upcoming events.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'update_event',
        description: 'Updates an existing event details.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_event',
        description: 'Removes an event from the calendar.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    ];
  }

  async schedule_event(args) {
    const { title, startTime, endTime, location, description } = args;
    console.log(`[CalendarAgent] Scheduling event: ${title}`);
    const event = await prisma.event.create({
      data: {
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: location || "",
        description: description || ""
      }
    });
    return `Event scheduled with ID: ${event.id}`;
  }

  async list_events(args) {
    const events = await prisma.event.findMany({
      orderBy: { startTime: 'asc' }
    });
    return JSON.stringify(events);
  }

  async update_event(args) {
    const { id, title, startTime, endTime } = args;
    const data = {};
    if (title) data.title = title;
    if (startTime) data.startTime = new Date(startTime);
    if (endTime) data.endTime = new Date(endTime);
    await prisma.event.update({ where: { id }, data });
    return `Event ${id} updated.`;
  }

  async delete_event(args) {
    const { id } = args;
    await prisma.event.delete({ where: { id } });
    return `Event ${id} deleted.`;
  }
}

module.exports = new CalendarAgent();
