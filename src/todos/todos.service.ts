import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      priority: createTodoDto.priority ?? 'medium',
      dependsOn: this.resolveDependsOn(createTodoDto.dependsOn),
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

    if (query.priority) {
      const priorities = new Set(query.priority.split(','));
      result = result.filter((todo) => priorities.has(todo.priority));
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

    if (query.sortBy === 'priority') {
      const rank: Record<'low' | 'medium' | 'high', number> = {
        low: 1,
        medium: 2,
        high: 3,
      };
      const direction = query.order === 'asc' ? -1 : 1;
      result = [...result].sort(
        (a, b) => direction * (rank[a.priority] - rank[b.priority]),
      );
    }

    return result;
  }

  findOne(id: string): TodoResponse {
    return this.toResponse(this.findTodoOrThrow(id));
  }

  update(id: string, updateTodoDto: UpdateTodoDto): TodoResponse {
    const todo = this.findTodoOrThrow(id);
    const { dueDate, dependsOn, ...rest } = updateTodoDto;
    Object.assign(todo, rest);
    if (dueDate !== undefined) {
      todo.dueDate = new Date(dueDate);
    }
    if (dependsOn !== undefined) {
      const resolved = this.resolveDependsOn(dependsOn);
      if (resolved.includes(id)) {
        throw new BadRequestException(`Todo ${id} cannot depend on itself`);
      }
      if (this.wouldCreateCycle(id, resolved)) {
        throw new BadRequestException(
          `Setting dependsOn on todo ${id} would create a dependency cycle`,
        );
      }
      todo.dependsOn = resolved;
    }
    if (todo.completed) {
      const incomplete = todo.dependsOn.filter((depId) => {
        const dep = this.todos.find((t) => t.id === depId);
        return !dep?.completed;
      });
      if (incomplete.length > 0) {
        throw new ConflictException(
          `Cannot complete todo ${id}: incomplete dependencies ${incomplete.join(', ')}`,
        );
      }
    }
    return this.toResponse(todo);
  }

  remove(id: string): void {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    const dependents = this.todos.filter((t) => t.dependsOn.includes(id));
    if (dependents.length > 0) {
      throw new ConflictException(
        `Cannot delete todo ${id}: still depended on by ${dependents
          .map((t) => t.id)
          .join(', ')}`,
      );
    }
    this.todos.splice(index, 1);
  }

  private resolveDependsOn(ids: string[] | undefined): string[] {
    if (!ids || ids.length === 0) {
      return [];
    }
    const unique = [...new Set(ids)];
    for (const depId of unique) {
      this.findTodoOrThrow(depId);
    }
    return unique;
  }

  private wouldCreateCycle(todoId: string, newDependsOn: string[]): boolean {
    const visited = new Set<string>();
    const stack = [...newDependsOn];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (current === todoId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const currentTodo = this.todos.find((t) => t.id === current);
      if (currentTodo) {
        stack.push(...currentTodo.dependsOn);
      }
    }
    return false;
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
