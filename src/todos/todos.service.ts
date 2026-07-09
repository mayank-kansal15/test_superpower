import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './todo.entity';

@Injectable()
export class TodosService {
  private readonly todos: Todo[] = [];

  create(createTodoDto: CreateTodoDto): Todo {
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
    return todo;
  }

  findAll(): Todo[] {
    return this.todos;
  }

  findOne(id: string): Todo {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    return todo;
  }

  update(id: string, updateTodoDto: UpdateTodoDto): Todo {
    const todo = this.findOne(id);
    const { dueDate, ...rest } = updateTodoDto;
    Object.assign(todo, rest);
    if (dueDate !== undefined) {
      todo.dueDate = new Date(dueDate);
    }
    return todo;
  }

  remove(id: string): void {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    this.todos.splice(index, 1);
  }
}
