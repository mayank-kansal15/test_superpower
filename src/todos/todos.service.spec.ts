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
});
