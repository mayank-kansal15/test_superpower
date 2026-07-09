# Todo Due Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `dueDate` to todos, a computed `isOverdue` flag, and sort/filter query params on `GET /todos`.

**Architecture:** Extend the existing in-memory `TodosService` — no new modules or storage layer. `dueDate` is stored on the `Todo` entity as a `Date`; `isOverdue` is computed on every read, never persisted. Filtering/sorting for `GET /todos` is validated by a new `FindTodosQueryDto` and executed in `TodosService.findAll`.

**Tech Stack:** NestJS 11, class-validator/class-transformer (global `ValidationPipe({ whitelist: true, transform: true })` already configured in `src/main.ts`), Jest + ts-jest for unit tests, Jest + supertest for e2e tests.

## Global Constraints

- No new dependencies — everything needed (`class-validator`, `class-transformer`) is already installed.
- Storage stays in-memory (no database) — out of scope per spec.
- `dueDate` accepts any valid ISO 8601 date, past or future — no future-only validation.
- `isOverdue` must never be persisted or accepted as client input — it is server-computed only.
- Todos without a `dueDate` always have `isOverdue: false` and sort to the end regardless of `order`.

Spec: `docs/superpowers/specs/2026-07-10-todo-due-dates-design.md`

---

### Task 1: Add `dueDate` to the entity and create/update DTOs

**Files:**
- Modify: `src/todos/todo.entity.ts`
- Modify: `src/todos/dto/create-todo.dto.ts`
- Modify: `src/todos/todos.service.ts`
- Test: `src/todos/todos.service.spec.ts`

**Interfaces:**
- Consumes: nothing new (builds directly on existing `Todo`, `CreateTodoDto`, `UpdateTodoDto`, `TodosService`).
- Produces: `Todo.dueDate?: Date`; `CreateTodoDto.dueDate?: string` (ISO 8601, validated); `UpdateTodoDto.dueDate?: string` (inherited via `PartialType`). `TodosService.create`/`update` convert the incoming ISO string to a `Date` before storing.

- [ ] **Step 1: Write the failing tests**

Add to `src/todos/todos.service.spec.ts` (inside the existing `describe('TodosService', ...)` block, after the existing tests):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- todos.service.spec.ts`
Expected: FAIL to compile with `TS2353: Object literal may only specify known properties, and 'dueDate' does not exist in type 'CreateTodoDto'` (and similarly for `update`), because `CreateTodoDto`/`Todo` don't have a `dueDate` field yet.

- [ ] **Step 3: Implement the entity, DTO, and service changes**

Replace the contents of `src/todos/todo.entity.ts`:

```ts
export class Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  dueDate?: Date;
}
```

Replace the contents of `src/todos/dto/create-todo.dto.ts`:

```ts
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
```

`src/todos/dto/update-todo.dto.ts` is unchanged — it already extends `PartialType(CreateTodoDto)`, so it picks up the new optional `dueDate` automatically.

Replace the contents of `src/todos/todos.service.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- todos.service.spec.ts`
Expected: PASS (all tests, including the 3 new ones and the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/todos/todo.entity.ts src/todos/dto/create-todo.dto.ts src/todos/todos.service.ts src/todos/todos.service.spec.ts
git commit -m "feat: add dueDate field to todos"
```

---

### Task 2: Compute `isOverdue` on every read path

**Files:**
- Modify: `src/todos/todos.service.ts`
- Test: `src/todos/todos.service.spec.ts`

**Interfaces:**
- Consumes: `Todo` from Task 1 (has `dueDate?: Date`).
- Produces: `export type TodoResponse = Todo & { isOverdue: boolean }`. `TodosService.create`, `findAll`, `findOne`, `update` now return `TodoResponse` / `TodoResponse[]` instead of `Todo` / `Todo[]`. `remove` is unchanged (still returns `void`).

- [ ] **Step 1: Write the failing tests**

Add to `src/todos/todos.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- todos.service.spec.ts`
Expected: FAIL to compile with `TS2339: Property 'isOverdue' does not exist on type 'Todo'`, since nothing computes or returns it yet.

- [ ] **Step 3: Implement `isOverdue` computation**

Replace the contents of `src/todos/todos.service.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- todos.service.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/todos/todos.service.ts src/todos/todos.service.spec.ts
git commit -m "feat: compute isOverdue flag on todo reads"
```

---

### Task 3: Add sort/filter query support to `findAll`

**Files:**
- Create: `src/todos/dto/find-todos-query.dto.ts`
- Modify: `src/todos/todos.service.ts`
- Test: `src/todos/todos.service.spec.ts`

**Interfaces:**
- Consumes: `TodoResponse` from Task 2.
- Produces: `FindTodosQueryDto` with fields `sortBy?: 'dueDate'`, `order?: 'asc' | 'desc'`, `overdue?: string` (`'true'`/`'false'`), `dueBefore?: string`, `dueAfter?: string`. `TodosService.findAll(query?: FindTodosQueryDto): TodoResponse[]`.

- [ ] **Step 1: Write the failing tests**

Add to `src/todos/todos.service.spec.ts`:

```ts
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
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- todos.service.spec.ts`
Expected: FAIL to compile with `TS2554: Expected 0 arguments, but got 1` on each `service.findAll({...})` call, since `findAll` doesn't accept a query argument yet.

- [ ] **Step 3: Implement the query DTO and `findAll` logic**

Create `src/todos/dto/find-todos-query.dto.ts`:

```ts
import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsOptional,
} from 'class-validator';

export class FindTodosQueryDto {
  @IsIn(['dueDate'])
  @IsOptional()
  sortBy?: 'dueDate';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc';

  @IsBooleanString()
  @IsOptional()
  overdue?: string;

  @IsDateString()
  @IsOptional()
  dueBefore?: string;

  @IsDateString()
  @IsOptional()
  dueAfter?: string;
}
```

In `src/todos/todos.service.ts`, add the import and replace the `findAll` method:

```ts
import { FindTodosQueryDto } from './dto/find-todos-query.dto';
```

```ts
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
      const direction = query.order === 'desc' ? -1 : 1;
      result = [...result].sort((a, b) => {
        if (a.dueDate === undefined && b.dueDate === undefined) return 0;
        if (a.dueDate === undefined) return 1;
        if (b.dueDate === undefined) return -1;
        return direction * (a.dueDate.getTime() - b.dueDate.getTime());
      });
    }

    return result;
  }
```

(Only `findAll` changes; `create`, `findOne`, `update`, `remove`, and the private helpers from Task 2 stay as they are.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- todos.service.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/todos/dto/find-todos-query.dto.ts src/todos/todos.service.ts src/todos/todos.service.spec.ts
git commit -m "feat: add sort/filter query support to findAll"
```

---

### Task 4: Wire the controller and add an end-to-end test

**Files:**
- Modify: `src/todos/todos.controller.ts`
- Create: `test/todos.e2e-spec.ts`

**Interfaces:**
- Consumes: `TodosService`, `TodoResponse`, `FindTodosQueryDto` from Tasks 1-3.
- Produces: `GET /todos` accepts `sortBy`, `order`, `overdue`, `dueBefore`, `dueAfter` query params.

- [ ] **Step 1: Write the failing e2e tests**

Create `test/todos.e2e-spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('TodosController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a todo with a dueDate and reports isOverdue', async () => {
    const response = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Overdue task', dueDate: '2000-01-01T00:00:00.000Z' })
      .expect(201);

    expect(response.body.dueDate).toBe('2000-01-01T00:00:00.000Z');
    expect(response.body.isOverdue).toBe(true);
  });

  it('sorts todos by dueDate descending', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Early', dueDate: '2026-01-01T00:00:00.000Z' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Late', dueDate: '2026-06-01T00:00:00.000Z' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/todos')
      .query({ sortBy: 'dueDate', order: 'desc' })
      .expect(200);

    expect(response.body.map((t: { title: string }) => t.title)).toEqual([
      'Late',
      'Early',
    ]);
  });

  it('filters todos with overdue=true', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Overdue', dueDate: '2000-01-01T00:00:00.000Z' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Future', dueDate: '2999-01-01T00:00:00.000Z' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/todos')
      .query({ overdue: 'true' })
      .expect(200);

    expect(response.body.map((t: { title: string }) => t.title)).toEqual([
      'Overdue',
    ]);
  });

  it('rejects an invalid dueDate', () => {
    return request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Bad date', dueDate: 'not-a-date' })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:e2e -- todos.e2e-spec.ts`
Expected: FAIL on `'sorts todos by dueDate descending'` and `'filters todos with overdue=true'` — the controller's `findAll` doesn't read query params yet, so both return todos in insertion order (`['Early', 'Late']`) and unfiltered, respectively. (The `dueDate`/`isOverdue`/validation tests already pass here, since Tasks 1-3 already implemented that behavior at the service and DTO level.)

- [ ] **Step 3: Wire `@Query()` into the controller**

Replace the contents of `src/todos/todos.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { FindTodosQueryDto } from './dto/find-todos-query.dto';
import { TodosService, TodoResponse } from './todos.service';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  create(@Body() createTodoDto: CreateTodoDto): TodoResponse {
    return this.todosService.create(createTodoDto);
  }

  @Get()
  findAll(@Query() query: FindTodosQueryDto): TodoResponse[] {
    return this.todosService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): TodoResponse {
    return this.todosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTodoDto: UpdateTodoDto,
  ): TodoResponse {
    return this.todosService.update(id, updateTodoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.todosService.remove(id);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:e2e -- todos.e2e-spec.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Run the full test suite**

Run: `npm test && npm run test:e2e`
Expected: PASS (every unit and e2e test, including `app.e2e-spec.ts` and `todos.service.spec.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/todos/todos.controller.ts test/todos.e2e-spec.ts
git commit -m "feat: expose due-date sort/filter query params on GET /todos"
```

---

## Self-Review Notes

- **Spec coverage:** `dueDate` field (Task 1), computed `isOverdue` (Task 2), sort by `dueDate` asc/desc with undated-last behavior (Task 3), `overdue`/`dueBefore`/`dueAfter` filters (Task 3), controller wiring + e2e smoke coverage (Task 4) — all spec sections have a corresponding task.
- **Type consistency:** `TodoResponse` (Task 2) is reused verbatim by `FindTodosQueryDto`'s consumer (Task 3's `findAll`) and by the controller (Task 4) — same name and shape throughout. `FindTodosQueryDto` field names (`sortBy`, `order`, `overdue`, `dueBefore`, `dueAfter`) match between Task 3's DTO and Task 3/4's usage.
- **No placeholders:** every step shows complete, runnable code and exact commands.
