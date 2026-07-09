import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { FindTodosQueryDto } from './dto/find-todos-query.dto';
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

  findAll(query: FindTodosQueryDto = {}): TodoResponse[] {
    let result = this.todos.map((todo) => this.toResponse(todo));

    if (query.overdue === 'true') {
      result = result.filter((todo) => todo.isOverdue);
    } else if (query.overdue === 'false') {
      result = result.filter((todo) => !todo.isOverdue);
    }

    if (query.dueAfter) {
      const after = new Date(query.dueAfter);
      result = result.filter(
        (todo) => todo.dueDate !== undefined && todo.dueDate >= after,
      );
    }

    if (query.dueBefore) {
      const before = new Date(query.dueBefore);
      result = result.filter(
        (todo) => todo.dueDate !== undefined && todo.dueDate <= before,
      );
    }

    if (query.sortBy === 'dueDate') {
      const direction = query.order === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        if (a.dueDate === undefined && b.dueDate === undefined) return 0;
        if (a.dueDate === undefined) return 1;
        if (b.dueDate === undefined) return -1;
        return direction * (a.dueDate.getTime() - b.dueDate.getTime());
      });
    }

    return result;
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
