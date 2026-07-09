import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './todo.entity';

export type TodoResponse = Todo & { isOverdue: boolean };

@Injectable()
export class TodosService {
  private readonly todos: Todo[] = [];

  create(createTodoDto: CreateTodoDto): TodoResponse {
    const todo: Todo = {
      id: randomUUID(),
      title: createTodoDto.title,
      description: createTodoDto.description,
      completed: createTodoDto.completed ?? false,
      createdAt: new Date(),
      dueDate: createTodoDto.dueDate
        ? new Date(createTodoDto.dueDate)
        : undefined,
    };
    this.todos.push(todo);
    return this.toResponse(todo);
  }

  findAll(): TodoResponse[] {
    return this.todos.map((todo) => this.toResponse(todo));
  }

  findOne(id: string): TodoResponse {
    return this.toResponse(this.findTodoOrThrow(id));
  }

  update(id: string, updateTodoDto: UpdateTodoDto): TodoResponse {
    const todo = this.findTodoOrThrow(id);
    const { dueDate, ...rest } = updateTodoDto;
    Object.assign(todo, rest);
    if (dueDate !== undefined) {
      todo.dueDate = new Date(dueDate);
    }
    return this.toResponse(todo);
  }

  remove(id: string): void {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    this.todos.splice(index, 1);
  }

  private findTodoOrThrow(id: string): Todo {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    return todo;
  }

  private toResponse(todo: Todo): TodoResponse {
    return { ...todo, isOverdue: this.isOverdue(todo) };
  }

  private isOverdue(todo: Todo): boolean {
    return (
      todo.dueDate !== undefined &&
      todo.dueDate.getTime() < Date.now() &&
      !todo.completed
    );
  }
}
