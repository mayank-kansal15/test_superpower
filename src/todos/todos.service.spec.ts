import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TodosService } from './todos.service';

describe('TodosService', () => {
  let service: TodosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TodosService],
    }).compile();

    service = module.get<TodosService>(TodosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a todo with defaults', () => {
    const todo = service.create({ title: 'Buy milk' });
    expect(todo.id).toBeDefined();
    expect(todo.title).toBe('Buy milk');
    expect(todo.completed).toBe(false);
  });

  it('should list all todos', () => {
    service.create({ title: 'A' });
    service.create({ title: 'B' });
    expect(service.findAll()).toHaveLength(2);
  });

  it('should find a todo by id', () => {
    const created = service.create({ title: 'Find me' });
    expect(service.findOne(created.id)).toEqual(created);
  });

  it('should throw when finding a missing todo', () => {
    expect(() => service.findOne('missing-id')).toThrow(NotFoundException);
  });

  it('should update a todo', () => {
    const created = service.create({ title: 'Old title' });
    const updated = service.update(created.id, { completed: true });
    expect(updated.completed).toBe(true);
    expect(updated.title).toBe('Old title');
  });

  it('should throw when updating a missing todo', () => {
    expect(() => service.update('missing-id', { completed: true })).toThrow(
      NotFoundException,
    );
  });

  it('should remove a todo', () => {
    const created = service.create({ title: 'Remove me' });
    service.remove(created.id);
    expect(service.findAll()).toHaveLength(0);
  });

  it('should throw when removing a missing todo', () => {
    expect(() => service.remove('missing-id')).toThrow(NotFoundException);
  });

  it('should create a todo with a dueDate', () => {
    const todo = service.create({
      title: 'Pay rent',
      dueDate: '2026-08-01T00:00:00.000Z',
    });
    expect(todo.dueDate).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  it('should create a todo without a dueDate', () => {
    const todo = service.create({ title: 'No due date' });
    expect(todo.dueDate).toBeUndefined();
  });

  it('should leave timezone undefined when not provided on create', () => {
    const todo = service.create({ title: 'No timezone' });
    expect(todo.timezone).toBeUndefined();
  });

  it('should store the given timezone on create', () => {
    const todo = service.create({
      title: 'Zoned',
      timezone: 'America/New_York',
    });
    expect(todo.timezone).toBe('America/New_York');
  });

  it('should resolve a bare dueDate to end-of-day in the given timezone on create', () => {
    const todo = service.create({
      title: 'Zoned due date',
      dueDate: '2026-07-20',
      timezone: 'America/New_York',
    });
    expect(todo.dueDate).toEqual(new Date('2026-07-21T03:59:59.999Z'));
  });

  it('should leave a bare dueDate at midnight UTC on create when no timezone is given', () => {
    const todo = service.create({
      title: 'No timezone due date',
      dueDate: '2026-07-20',
    });
    expect(todo.dueDate).toEqual(new Date('2026-07-20T00:00:00.000Z'));
  });

  it('should ignore timezone on create when dueDate is a full ISO datetime string', () => {
    const todo = service.create({
      title: 'Full ISO due date',
      dueDate: '2026-07-20T15:00:00.000Z',
      timezone: 'America/New_York',
    });
    expect(todo.dueDate).toEqual(new Date('2026-07-20T15:00:00.000Z'));
  });

  it('should default priority to medium when not specified', () => {
    const todo = service.create({ title: 'No priority given' });
    expect(todo.priority).toBe('medium');
  });

  it('should create a todo with an explicit priority', () => {
    const todo = service.create({ title: 'Urgent', priority: 'high' });
    expect(todo.priority).toBe('high');
  });

  it('should update a todo priority', () => {
    const created = service.create({ title: 'Reprioritize me' });
    const updated = service.update(created.id, { priority: 'low' });
    expect(updated.priority).toBe('low');
  });

  it('should update a todo dueDate', () => {
    const created = service.create({ title: 'Reschedule me' });
    const updated = service.update(created.id, {
      dueDate: '2026-09-01T00:00:00.000Z',
    });
    expect(updated.dueDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
  });

  it('should default dependsOn to an empty array', () => {
    const todo = service.create({ title: 'No deps' });
    expect(todo.dependsOn).toEqual([]);
  });

  it('should create a todo with a valid dependsOn list', () => {
    const dep = service.create({ title: 'Dependency' });
    const todo = service.create({
      title: 'Depends on one',
      dependsOn: [dep.id],
    });
    expect(todo.dependsOn).toEqual([dep.id]);
  });

  it('should dedupe repeated ids in dependsOn', () => {
    const dep = service.create({ title: 'Dependency' });
    const todo = service.create({
      title: 'Depends on one, twice',
      dependsOn: [dep.id, dep.id],
    });
    expect(todo.dependsOn).toEqual([dep.id]);
  });

  it('should throw when creating with an unknown dependsOn id', () => {
    expect(() =>
      service.create({ title: 'Bad dep', dependsOn: ['missing-id'] }),
    ).toThrow(NotFoundException);
  });

  it('should update a todo to add a valid dependency', () => {
    const dep = service.create({ title: 'Dependency' });
    const created = service.create({ title: 'Depends on nothing yet' });
    const updated = service.update(created.id, { dependsOn: [dep.id] });
    expect(updated.dependsOn).toEqual([dep.id]);
  });

  it('should throw when updating with an unknown dependsOn id', () => {
    const created = service.create({ title: 'Target' });
    expect(() =>
      service.update(created.id, { dependsOn: ['missing-id'] }),
    ).toThrow(NotFoundException);
  });

  it('should throw when a todo is set to depend on itself', () => {
    const created = service.create({ title: 'Self referencer' });
    expect(() =>
      service.update(created.id, { dependsOn: [created.id] }),
    ).toThrow(BadRequestException);
  });

  it('should throw when creating a 2-node dependency cycle', () => {
    const a = service.create({ title: 'A' });
    const b = service.create({ title: 'B', dependsOn: [a.id] });
    expect(() => service.update(a.id, { dependsOn: [b.id] })).toThrow(
      BadRequestException,
    );
  });

  it('should throw when creating a 3-node dependency cycle', () => {
    const a = service.create({ title: 'A' });
    const b = service.create({ title: 'B', dependsOn: [a.id] });
    const c = service.create({ title: 'C', dependsOn: [b.id] });
    expect(() => service.update(a.id, { dependsOn: [c.id] })).toThrow(
      BadRequestException,
    );
  });

  it('should throw when completing a todo with incomplete dependencies', () => {
    const dep = service.create({ title: 'Dependency' });
    const todo = service.create({
      title: 'Depends on incomplete',
      dependsOn: [dep.id],
    });
    expect(() => service.update(todo.id, { completed: true })).toThrow(
      ConflictException,
    );
  });

  it('should allow completing a todo once all dependencies are completed', () => {
    const dep = service.create({ title: 'Dependency' });
    const todo = service.create({
      title: 'Depends on soon-to-be-complete',
      dependsOn: [dep.id],
    });
    service.update(dep.id, { completed: true });
    const updated = service.update(todo.id, { completed: true });
    expect(updated.completed).toBe(true);
  });

  it('should allow un-completing a todo regardless of dependencies', () => {
    const dep = service.create({ title: 'Dependency' });
    const todo = service.create({
      title: 'Depends on incomplete',
      dependsOn: [dep.id],
      completed: true,
    });
    const updated = service.update(todo.id, { completed: false });
    expect(updated.completed).toBe(false);
  });

  it('should throw when deleting a todo that another todo depends on', () => {
    const dep = service.create({ title: 'Dependency' });
    service.create({ title: 'Depends on it', dependsOn: [dep.id] });
    expect(() => service.remove(dep.id)).toThrow(ConflictException);
  });

  it('should allow deleting a todo with no dependents', () => {
    const todo = service.create({ title: 'No dependents' });
    service.remove(todo.id);
    expect(service.findAll()).toHaveLength(0);
  });

  it('should mark a todo overdue when dueDate is in the past and not completed', () => {
    const todo = service.create({
      title: 'Overdue task',
      dueDate: '2000-01-01T00:00:00.000Z',
    });
    expect(todo.isOverdue).toBe(true);
  });

  it('should not mark a completed todo as overdue', () => {
    const todo = service.create({
      title: 'Completed but past due',
      dueDate: '2000-01-01T00:00:00.000Z',
      completed: true,
    });
    expect(todo.isOverdue).toBe(false);
  });

  it('should not mark a todo without a dueDate as overdue', () => {
    const todo = service.create({ title: 'No due date' });
    expect(todo.isOverdue).toBe(false);
  });

  it('should not mark a future dueDate as overdue', () => {
    const todo = service.create({
      title: 'Future task',
      dueDate: '2999-01-01T00:00:00.000Z',
    });
    expect(todo.isOverdue).toBe(false);
  });

  it('should include isOverdue on findAll and findOne results', () => {
    const created = service.create({
      title: 'Check propagation',
      dueDate: '2000-01-01T00:00:00.000Z',
    });
    expect(service.findAll()[0].isOverdue).toBe(true);
    expect(service.findOne(created.id).isOverdue).toBe(true);
  });

  describe('findAll with query', () => {
    it('should sort by dueDate ascending', () => {
      service.create({ title: 'B', dueDate: '2026-06-01T00:00:00.000Z' });
      service.create({ title: 'A', dueDate: '2026-01-01T00:00:00.000Z' });
      const result = service.findAll({ sortBy: 'dueDate', order: 'asc' });
      expect(result.map((t) => t.title)).toEqual(['A', 'B']);
    });

    it('should sort by dueDate descending', () => {
      service.create({ title: 'B', dueDate: '2026-06-01T00:00:00.000Z' });
      service.create({ title: 'A', dueDate: '2026-01-01T00:00:00.000Z' });
      const result = service.findAll({ sortBy: 'dueDate', order: 'desc' });
      expect(result.map((t) => t.title)).toEqual(['B', 'A']);
    });

    it('should sort todos without a dueDate to the end regardless of order', () => {
      service.create({ title: 'No date' });
      service.create({ title: 'Dated', dueDate: '2026-01-01T00:00:00.000Z' });
      const asc = service.findAll({ sortBy: 'dueDate', order: 'asc' });
      const desc = service.findAll({ sortBy: 'dueDate', order: 'desc' });
      expect(asc.map((t) => t.title)).toEqual(['Dated', 'No date']);
      expect(desc.map((t) => t.title)).toEqual(['Dated', 'No date']);
    });

    it('should filter by overdue=true', () => {
      service.create({
        title: 'Overdue',
        dueDate: '2000-01-01T00:00:00.000Z',
      });
      service.create({
        title: 'Not overdue',
        dueDate: '2999-01-01T00:00:00.000Z',
      });
      const result = service.findAll({ overdue: 'true' });
      expect(result.map((t) => t.title)).toEqual(['Overdue']);
    });

    it('should filter by dueAfter', () => {
      service.create({ title: 'Early', dueDate: '2026-01-01T00:00:00.000Z' });
      service.create({ title: 'Late', dueDate: '2026-06-01T00:00:00.000Z' });
      const result = service.findAll({ dueAfter: '2026-03-01T00:00:00.000Z' });
      expect(result.map((t) => t.title)).toEqual(['Late']);
    });

    it('should filter by dueBefore', () => {
      service.create({ title: 'Early', dueDate: '2026-01-01T00:00:00.000Z' });
      service.create({ title: 'Late', dueDate: '2026-06-01T00:00:00.000Z' });
      const result = service.findAll({
        dueBefore: '2026-03-01T00:00:00.000Z',
      });
      expect(result.map((t) => t.title)).toEqual(['Early']);
    });

    it('should combine dueAfter and dueBefore into a range', () => {
      service.create({
        title: 'Too early',
        dueDate: '2026-01-01T00:00:00.000Z',
      });
      service.create({
        title: 'In range',
        dueDate: '2026-03-15T00:00:00.000Z',
      });
      service.create({
        title: 'Too late',
        dueDate: '2026-06-01T00:00:00.000Z',
      });
      const result = service.findAll({
        dueAfter: '2026-03-01T00:00:00.000Z',
        dueBefore: '2026-04-01T00:00:00.000Z',
      });
      expect(result.map((t) => t.title)).toEqual(['In range']);
    });

    it('should filter by a single priority value', () => {
      service.create({ title: 'Urgent', priority: 'high' });
      service.create({ title: 'Chill', priority: 'low' });
      const result = service.findAll({ priority: 'high' });
      expect(result.map((t) => t.title)).toEqual(['Urgent']);
    });

    it('should filter by multiple comma-separated priority values', () => {
      service.create({ title: 'Urgent', priority: 'high' });
      service.create({ title: 'Normal', priority: 'medium' });
      service.create({ title: 'Chill', priority: 'low' });
      const result = service.findAll({ priority: 'high,medium' });
      expect(result.map((t) => t.title)).toEqual(['Urgent', 'Normal']);
    });

    it('should sort by priority ascending (high to low)', () => {
      service.create({ title: 'Low one', priority: 'low' });
      service.create({ title: 'High one', priority: 'high' });
      service.create({ title: 'Medium one', priority: 'medium' });
      const result = service.findAll({ sortBy: 'priority', order: 'asc' });
      expect(result.map((t) => t.title)).toEqual([
        'High one',
        'Medium one',
        'Low one',
      ]);
    });

    it('should sort by priority descending (low to high)', () => {
      service.create({ title: 'Low one', priority: 'low' });
      service.create({ title: 'High one', priority: 'high' });
      service.create({ title: 'Medium one', priority: 'medium' });
      const result = service.findAll({ sortBy: 'priority', order: 'desc' });
      expect(result.map((t) => t.title)).toEqual([
        'Low one',
        'Medium one',
        'High one',
      ]);
    });

    it('should combine a priority filter with a priority sort', () => {
      service.create({ title: 'Low one', priority: 'low' });
      service.create({ title: 'High one', priority: 'high' });
      service.create({ title: 'Medium one', priority: 'medium' });
      const result = service.findAll({
        priority: 'high,medium',
        sortBy: 'priority',
        order: 'asc',
      });
      expect(result.map((t) => t.title)).toEqual(['High one', 'Medium one']);
    });
  });
});
