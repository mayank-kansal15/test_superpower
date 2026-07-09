import { NotFoundException } from '@nestjs/common';
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

  it('should update a todo dueDate', () => {
    const created = service.create({ title: 'Reschedule me' });
    const updated = service.update(created.id, {
      dueDate: '2026-09-01T00:00:00.000Z',
    });
    expect(updated.dueDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
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
});
