import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailTemplatesService } from './email-templates.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  emailTemplate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmailTemplatesService(mockPrisma as any);
  });

  describe('findAll', () => {
    it('returns all templates ordered by name', async () => {
      mockPrisma.emailTemplate.findMany.mockResolvedValue([
        { id: '1', name: 'welcome', subject: 'Welcome', bodyHtml: '<p>Hi</p>', variables: [], isActive: true },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('welcome');
    });
  });

  describe('findByName', () => {
    it('returns template by name', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({
        id: '1', name: 'welcome', subject: 'Welcome', bodyHtml: '<p>Hi</p>', variables: [], isActive: true,
      });

      const result = await service.findByName('welcome');

      expect(result?.name).toBe('welcome');
    });
  });

  describe('create', () => {
    it('creates a new template', async () => {
      mockPrisma.emailTemplate.create.mockResolvedValue({
        id: '1', name: 'test', subject: 'Test', bodyHtml: '<p>Test</p>', variables: ['a'], isActive: true,
      });

      const result = await service.create({
        name: 'test', subject: 'Test', bodyHtml: '<p>Test</p>', variables: ['a'],
      });

      expect(result.name).toBe('test');
    });
  });

  describe('renderTemplate', () => {
    it('replaces variables in subject and body', () => {
      const template = {
        subject: 'Hello {{name}}',
        bodyHtml: '<p>Welcome {{name}} to {{hotel}}</p>',
      };

      const result = service.renderTemplate(template, { name: 'Ana', hotel: 'Hotel Test' });

      expect(result.subject).toBe('Hello Ana');
      expect(result.bodyHtml).toBe('<p>Welcome Ana to Hotel Test</p>');
    });

    it('handles missing variables gracefully', () => {
      const template = {
        subject: 'Hello {{name}}',
        bodyHtml: '<p>Welcome</p>',
      };

      const result = service.renderTemplate(template, {});

      expect(result.subject).toBe('Hello {{name}}');
    });
  });

  describe('seedBaseTemplates', () => {
    it('seeds templates if none exist', async () => {
      mockPrisma.emailTemplate.count.mockResolvedValue(0);
      mockPrisma.emailTemplate.create.mockResolvedValue({});

      await service.seedBaseTemplates();

      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledTimes(4);
    });

    it('skips seeding if templates already exist', async () => {
      mockPrisma.emailTemplate.count.mockResolvedValue(2);

      await service.seedBaseTemplates();

      expect(mockPrisma.emailTemplate.create).not.toHaveBeenCalled();
    });
  });
});
