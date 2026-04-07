const prisma = require('../db');

class MemoryAgent {
  constructor() {
    this.name = "MemoryAgent";
    this.description = "Manages notes and historical data.";
  }

  getTools() {
    return [
      {
        name: 'save_note',
        description: 'Saves a piece of information or note to the database.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'string' }
          },
          required: ['title', 'content']
        }
      },
      {
        name: 'search_notes',
        description: 'Searches through stored notes using a query string.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          }
        }
      },
      {
        name: 'update_note',
        description: 'Updates note title or content.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_note',
        description: 'Deletes a note forever.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    ];
  }

  async save_note(args) {
    const { title, content, tags } = args;
    console.log(`[MemoryAgent] Saving note: ${title}`);
    const note = await prisma.note.create({
      data: {
        title,
        content,
        tags: tags || ""
      }
    });
    return `Note saved with ID: ${note.id}`;
  }

  async search_notes(args) {
    const where = {};
    if (args && args.query) {
      where.OR = [
        { title: { contains: args.query } },
        { content: { contains: args.query } }
      ];
    }
    const notes = await prisma.note.findMany({ where });
    return JSON.stringify(notes);
  }

  async update_note(args) {
    const { id, title, content } = args;
    const data = {};
    if (title) data.title = title;
    if (content) data.content = content;
    await prisma.note.update({ where: { id }, data });
    return `Note ${id} updated.`;
  }

  async delete_note(args) {
    const { id } = args;
    await prisma.note.delete({ where: { id } });
    return `Note ${id} deleted.`;
  }
}

module.exports = new MemoryAgent();
